import type { Feedback, TastePreferences } from '../contracts/account';
import type { RecommendationResult, RecommendationRequest } from '../contracts/recommendation';
import type { Tea } from '../contracts/tea';
import { ApplicationError } from './errors';
import type { TeaTaxonomyReference } from './repositories';

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new ApplicationError('VALIDATION_ERROR', `${field} is required`);
  }
}

export function validateId(value: string, field = 'id'): void {
  assertNonEmpty(value, field);
}

export function validateTea(tea: Tea, taxonomy: TeaTaxonomyReference): void {
  validateId(tea.id, 'tea.id');
  assertNonEmpty(tea.slug, 'tea.slug');
  assertNonEmpty(tea.name, 'tea.name');
  assertNonEmpty(taxonomy.familyId, 'taxonomy.familyId');
  if (taxonomy.styleId && !taxonomy.subfamilyId) {
    throw new ApplicationError('VALIDATION_ERROR', 'taxonomy.subfamilyId is required when taxonomy.styleId is provided');
  }
  if (!Number.isInteger(tea.price.amount) || tea.price.amount < 0) {
    throw new ApplicationError('VALIDATION_ERROR', 'tea.price.amount must be a non-negative integer minor-unit amount');
  }
  if (!/^[A-Z]{3}$/.test(tea.price.currency)) {
    throw new ApplicationError('VALIDATION_ERROR', 'tea.price.currency must be an uppercase ISO 4217 code');
  }
  if (!Number.isInteger(tea.packSize) || tea.packSize <= 0) {
    throw new ApplicationError('VALIDATION_ERROR', 'tea.packSize must be a positive integer');
  }
  if (!Number.isInteger(tea.inventory) || tea.inventory < 0) {
    throw new ApplicationError('VALIDATION_ERROR', 'tea.inventory must be a non-negative integer');
  }
  if (!Number.isInteger(tea.discoveryDistance) || tea.discoveryDistance < 0 || tea.discoveryDistance > 100) {
    throw new ApplicationError('VALIDATION_ERROR', 'tea.discoveryDistance must be between 0 and 100');
  }
}

export function validateCustomerEmail(email: string): void {
  assertNonEmpty(email, 'customer.email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApplicationError('VALIDATION_ERROR', 'customer.email must be a valid email address');
  }
}

export function validateTastePreferences(preferences: TastePreferences): void {
  for (const [name, value] of [
    ['body', preferences.body],
    ['sweetness', preferences.sweetness],
    ['freshness', preferences.freshness],
    ['roastDepth', preferences.roastDepth],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100)) {
      throw new ApplicationError('VALIDATION_ERROR', `tastePreferences.${name} must be between 0 and 100`);
    }
  }
  if (preferences.aroma?.some((value) => !value.trim())) {
    throw new ApplicationError('VALIDATION_ERROR', 'tastePreferences.aroma cannot contain empty values');
  }
}

export function validateFeedback(feedback: Feedback): void {
  validateId(feedback.id, 'feedback.id');
  validateId(feedback.customerId, 'feedback.customerId');
  validateId(feedback.teaId, 'feedback.teaId');
  if (!['Loved it', 'Liked it', 'Not for me'].includes(feedback.value)) {
    throw new ApplicationError('VALIDATION_ERROR', 'feedback.value is invalid');
  }
  if (feedback.sensoryTags.some((tag) => !tag.trim())) {
    throw new ApplicationError('VALIDATION_ERROR', 'feedback.sensoryTags cannot contain empty values');
  }
  assertNonEmpty(feedback.createdAt, 'feedback.createdAt');
}

export function validateRecommendationRequest(request: RecommendationRequest): void {
  if (!request.profileReference) {
    throw new ApplicationError('VALIDATION_ERROR', 'recommendation.profileReference is required');
  }
  if (request.candidateTeaIds?.some((id) => !id.trim())) {
    throw new ApplicationError('VALIDATION_ERROR', 'recommendation.candidateTeaIds cannot contain empty identifiers');
  }
}

export function validateRecommendationResult(result: RecommendationResult): void {
  validateId(result.tea.id, 'recommendation.tea.id');
  assertNonEmpty(result.tea.slug, 'recommendation.tea.slug');
  assertNonEmpty(result.tea.name, 'recommendation.tea.name');
  if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100) {
    throw new ApplicationError('VALIDATION_ERROR', 'recommendation.score must be between 0 and 100');
  }
  if (!['MATCH', 'STRETCH', 'WILDCARD'].includes(result.classification)) {
    throw new ApplicationError('VALIDATION_ERROR', 'recommendation.classification is invalid');
  }
  assertNonEmpty(result.algorithmVersion, 'recommendation.algorithmVersion');
  assertNonEmpty(result.createdAt, 'recommendation.createdAt');
}
