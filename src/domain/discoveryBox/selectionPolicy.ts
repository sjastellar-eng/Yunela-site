import type { DiscoveryBoxItem } from '../../contracts/discoveryBox';
import type { RecommendationResult } from '../../contracts/recommendation';
import { ApplicationError } from '../../application/errors';

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

function sortedCandidates(results: RecommendationResult[], role: RecommendationResult['classification']): RecommendationResult[] {
  return results
    .filter((result) => result.classification === role)
    .sort((a, b) => b.score - a.score || a.tea.id.localeCompare(b.tea.id));
}

export function selectDiscoveryBoxItems(results: RecommendationResult[]): DiscoveryBoxItem[] {
  const failures: SelectionFailureDetail[] = [];
  const selected: DiscoveryBoxItem[] = [];
  const selectedTeaIds = new Set<string>();
  const roles: Array<keyof typeof REQUIRED_COUNTS> = ['MATCH', 'STRETCH', 'WILDCARD'];

  for (const role of roles) {
    const candidates = sortedCandidates(results, role);
    const uniqueCandidates = candidates.filter((result) => {
      if (selectedTeaIds.has(result.tea.id)) return false;
      return true;
    });
    const required = REQUIRED_COUNTS[role];
    if (uniqueCandidates.length < required) {
      failures.push({ role, required, available: uniqueCandidates.length });
      continue;
    }
    for (const result of uniqueCandidates.slice(0, required)) {
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
    throw new ApplicationError(
      'DISCOVERY_BOX_INSUFFICIENT_CANDIDATES',
      'Discovery Box cannot be filled for all required roles',
      { cause: failures },
    );
  }

  return selected;
}
