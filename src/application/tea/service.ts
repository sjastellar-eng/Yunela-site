import type { Tea } from '../../contracts/tea';
import { ApplicationError } from '../errors';
import type { TeaRepository, TeaTaxonomyReference, TeaWriteInput } from '../repositories';
import { validateTea } from '../validation';

export type CreateTeaInput = TeaWriteInput;
export type UpdateTeaInput = TeaWriteInput;

export class TeaService {
  constructor(private readonly repository: TeaRepository) {}

  createTea(tea: CreateTeaInput, taxonomy: TeaTaxonomyReference): Tea {
    validateTea(tea, taxonomy);
    if (this.repository.getById(tea.id)) {
      throw new ApplicationError('CONFLICT', `Tea ${tea.id} already exists`);
    }
    this.repository.create(tea, taxonomy);
    const created = this.repository.getById(tea.id);
    if (!created) {
      throw new ApplicationError('PERSISTENCE_ERROR', `Tea ${tea.id} could not be read after creation`);
    }
    return created;
  }

  getTeaById(id: string): Tea {
    if (!id.trim()) throw new ApplicationError('VALIDATION_ERROR', 'tea.id is required');
    const tea = this.repository.getById(id);
    if (!tea) throw new ApplicationError('NOT_FOUND', `Tea ${id} was not found`);
    return tea;
  }

  listTeas(): Tea[] {
    return this.repository.list();
  }

  updateTea(tea: UpdateTeaInput, taxonomy: TeaTaxonomyReference): Tea {
    validateTea(tea, taxonomy);
    const updated = this.repository.update(tea, taxonomy);
    if (!updated) throw new ApplicationError('NOT_FOUND', `Tea ${tea.id} was not found`);
    return updated;
  }
}
