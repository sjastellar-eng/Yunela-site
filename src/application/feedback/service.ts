import type { Feedback, TeaProfile } from '../../contracts/account';
import type { FinderProfileReference } from '../../contracts/recommendation';
import { rebuildTastePreferences, toFinderProfileReference } from '../../domain/profile/feedbackMapping';
import { ApplicationError } from '../errors';
import type { CustomerRepository, FeedbackRepository, TeaProfileRepository, TeaRepository } from '../repositories';
import { validateFeedback } from '../validation';

export class FeedbackService {
  constructor(
    private readonly repository: FeedbackRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly teaRepository: TeaRepository,
    private readonly profileRepository: TeaProfileRepository,
  ) {}

  submitFeedback(feedback: Feedback): Feedback {
    validateFeedback(feedback);
    if (!this.customerRepository.getById(feedback.customerId)) {
      throw new ApplicationError('NOT_FOUND', `Customer ${feedback.customerId} was not found`);
    }
    if (!this.teaRepository.getById(feedback.teaId)) {
      throw new ApplicationError('NOT_FOUND', `Tea ${feedback.teaId} was not found`);
    }
    if (this.repository.listByCustomerId(feedback.customerId).some((item) => item.id === feedback.id)) {
      throw new ApplicationError('CONFLICT', `Feedback ${feedback.id} already exists`);
    }

    this.repository.create(feedback);
    const persisted = this.repository.listByCustomerId(feedback.customerId).find((item) => item.id === feedback.id);
    if (!persisted) throw new ApplicationError('PERSISTENCE_ERROR', `Feedback ${feedback.id} could not be read after creation`);

    this.rebuildCustomerProfile(feedback.customerId);
    return persisted;
  }

  getCustomerFeedback(customerId: string): Feedback[] {
    if (!customerId.trim()) throw new ApplicationError('VALIDATION_ERROR', 'customerId is required');
    if (!this.customerRepository.getById(customerId)) {
      throw new ApplicationError('NOT_FOUND', `Customer ${customerId} was not found`);
    }
    return this.repository.listByCustomerId(customerId);
  }

  getTeaFeedback(teaId: string): Feedback[] {
    if (!teaId.trim()) throw new ApplicationError('VALIDATION_ERROR', 'teaId is required');
    if (!this.teaRepository.getById(teaId)) {
      throw new ApplicationError('NOT_FOUND', `Tea ${teaId} was not found`);
    }
    return this.repository.listByTeaId(teaId);
  }

  rebuildCustomerProfile(customerId: string): TeaProfile {
    if (!this.customerRepository.getById(customerId)) {
      throw new ApplicationError('NOT_FOUND', `Customer ${customerId} was not found`);
    }

    const existing = this.profileRepository.getByCustomerId(customerId);
    const feedbackHistory = this.repository.listByCustomerId(customerId);
    const tastePreferences = rebuildTastePreferences(feedbackHistory);
    const feedbackIds = feedbackHistory.map((item) => item.id);
    const updatedAt = feedbackHistory.length > 0
      ? feedbackHistory[feedbackHistory.length - 1].createdAt
      : existing?.updatedAt ?? new Date(0).toISOString();

    const profile: TeaProfile = {
      customerId,
      purchasedTeaIds: existing?.purchasedTeaIds ?? [],
      likedTeaIds: existing?.likedTeaIds ?? [],
      dislikedTeaIds: existing?.dislikedTeaIds ?? [],
      tastePreferences,
      feedbackIds,
      recommendationIds: existing?.recommendationIds ?? [],
      updatedAt,
    };

    this.profileRepository.upsert(profile);
    return profile;
  }

  getFinderProfileReference(customerId: string): FinderProfileReference {
    const profile = this.profileRepository.getByCustomerId(customerId);
    if (!profile) throw new ApplicationError('NOT_FOUND', `Tea profile for customer ${customerId} was not found`);
    return toFinderProfileReference(profile.tastePreferences);
  }
}
