import type { DiscoveryBoxItem } from '../../contracts/discoveryBox';
import type { RecommendationResult } from '../../contracts/recommendation';

const REQUIRED_COUNTS = {
  MATCH: 3,
  STRETCH: 2,
  WILDCARD: 1,
} as const;

export interface SelectionFailureDetail {
  role: keyof typeof REQUIRED_COUNTS;
  required: number;
  available: number;
}

export class DiscoveryBoxSelectionFailure extends Error {
  readonly details: SelectionFailureDetail[];

  constructor(details: SelectionFailureDetail[]) {
    super('Discovery Box cannot be filled for all required roles');
    this.name = 'DiscoveryBoxSelectionFailure';
    this.details = details;
  }
}

function uniqueAndSortedCandidates(
  results: RecommendationResult[],
  role: RecommendationResult['classification'],
  selectedTeaIds: Set<string>,
): RecommendationResult[] {
  const seen = new Set<string>(selectedTeaIds);
  return results
    .filter((result) => result.classification === role)
    .filter((result) => {
      if (seen.has(result.tea.id)) return false;
      seen.add(result.tea.id);
      return true;
    })
    .sort((a, b) => b.score - a.score || a.tea.id.localeCompare(b.tea.id));
}

export function selectDiscoveryBoxItems(results: RecommendationResult[]): DiscoveryBoxItem[] {
  const failures: SelectionFailureDetail[] = [];
  const selected: DiscoveryBoxItem[] = [];
  const selectedTeaIds = new Set<string>();
  const roles: Array<keyof typeof REQUIRED_COUNTS> = ['MATCH', 'STRETCH', 'WILDCARD'];

  for (const role of roles) {
    const candidates = uniqueAndSortedCandidates(results, role, selectedTeaIds);
    const required = REQUIRED_COUNTS[role];
    if (candidates.length < required) {
      failures.push({ role, required, available: candidates.length });
      continue;
    }
    for (const result of candidates.slice(0, required)) {
      selectedTeaIds.add(result.tea.id);
      selected.push({
        teaId: result.tea.id,
        classification: result.classification,
        position: selected.length + 1,
        score: result.score,
        reasons: [...result.reasons],
      });
    }
  }

  if (failures.length > 0) {
    throw new DiscoveryBoxSelectionFailure(failures);
  }

  return selected;
}
