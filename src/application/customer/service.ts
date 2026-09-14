import type { Customer } from '../../contracts/account';
import { ApplicationError } from '../errors';
import type { CustomerRepository } from '../repositories';
import { validateCustomerEmail, validateId } from '../validation';

export class CustomerService {
  constructor(private readonly repository: CustomerRepository) {}

  createCustomer(customer: Customer): Customer {
    validateId(customer.id, 'customer.id');
    validateCustomerEmail(customer.email);
    if (!customer.createdAt.trim()) throw new ApplicationError('VALIDATION_ERROR', 'customer.createdAt is required');
    if (this.repository.getById(customer.id)) {
      throw new ApplicationError('CONFLICT', `Customer ${customer.id} already exists`);
    }
    this.repository.create(customer);
    const created = this.repository.getById(customer.id);
    if (!created) throw new ApplicationError('PERSISTENCE_ERROR', `Customer ${customer.id} could not be read after creation`);
    return created;
  }

  getCustomer(id: string): Customer {
    validateId(id, 'customer.id');
    const customer = this.repository.getById(id);
    if (!customer) throw new ApplicationError('NOT_FOUND', `Customer ${id} was not found`);
    return customer;
  }

  updateCustomer(customer: Customer): Customer {
    validateId(customer.id, 'customer.id');
    validateCustomerEmail(customer.email);
    const updated = this.repository.update(customer);
    if (!updated) throw new ApplicationError('NOT_FOUND', `Customer ${customer.id} was not found`);
    return updated;
  }
}
