import type { TeaProfile } from '../../contracts/account';
import { ApplicationError } from '../errors';
import type { CustomerRepository, TeaProfileRepository } from '../repositories';
import { validateId, validateTastePreferences } from '../validation';

export class TeaProfileService {
  constructor(
    private readonly profileRepository: TeaProfileRepository,
    private readonly customerRepository: CustomerRepository,
  ) {}

  getTeaProfile(customerId: string): TeaProfile {
    validateId(customerId, 'customerId');
    this.requireCustomer(customerId);
    const profile = this.profileRepository.getByCustomerId(customerId);
    if (!profile) throw new ApplicationError('NOT_FOUND', `Tea profile for customer ${customerId} was not found`);
    return profile;
  }

  createTeaProfile(profile: TeaProfile): TeaProfile {
    this.validateProfile(profile);
    this.requireCustomer(profile.customerId);
    if (this.profileRepository.getByCustomerId(profile.customerId)) {
      throw new ApplicationError('CONFLICT', `Tea profile for customer ${profile.customerId} already exists`);
    }
    this.profileRepository.upsert(profile);
    return this.getTeaProfile(profile.customerId);
  }

  updateTeaProfile(profile: TeaProfile): TeaProfile {
    this.validateProfile(profile);
    this.requireCustomer(profile.customerId);
    if (!this.profileRepository.getByCustomerId(profile.customerId)) {
      throw new ApplicationError('NOT_FOUND', `Tea profile for customer ${profile.customerId} was not found`);
    }
    this.profileRepository.upsert(profile);
    return this.getTeaProfile(profile.customerId);
  }

  private requireCustomer(customerId: string): void {
    if (!this.customerRepository.getById(customerId)) {
      throw new ApplicationError('NOT_FOUND', `Customer ${customerId} was not found`);
    }
  }

  private validateProfile(profile: TeaProfile): void {
    validateId(profile.customerId, 'profile.customerId');
    validateTastePreferences(profile.tastePreferences);
    if (!profile.updatedAt.trim()) throw new ApplicationError('VALIDATION_ERROR', 'profile.updatedAt is required');
  }
}
