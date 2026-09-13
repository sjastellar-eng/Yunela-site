import type { Feedback } from '../../contracts/account';
import { ApplicationError } from '../errors';
import type { CustomerRepository, FeedbackRepository, TeaRepository } from '../repositories';
import { validateFeedback } from '../validation';

export class FeedbackService {
  constructor(
    private readonly repository: FeedbackRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly teaRepository: TeaRepository,
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
}
