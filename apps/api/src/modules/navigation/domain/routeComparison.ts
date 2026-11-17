import type { RouteComparisonFact, RouteComparisonResult, RoutePreference } from '@routetwin/shared';

// VietMap signs: left/right, including slight/sharp turns, and U-turns.
const turns = new Set([-98, -8, -3, -2, -1, 1, 2, 3, 8]);
const otherSigns = new Set([-7, 0, 4, 5, 6, 7]);

export function countRouteTurns(instructions: readonly { sign?: number }[]): number | null {
  if (
    instructions.length === 0 ||
    instructions.some(({ sign }) => sign === undefined || (!turns.has(sign) && !otherSigns.has(sign)))
  ) {
    return null;
  }
  return instructions.filter(({ sign }) => sign !== undefined && turns.has(sign)).length;
}

const noPreference: RoutePreference = { goal: null, maxExtraMinutes: null };

export function readRoutePreference(text: string): RoutePreference {
  const query = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll('đ', 'd');
  if (/\b(?:an toan|ket xe|tac duong|thu phi|mien phi|cao toc|tranh pha|safety|traffic|toll)\b/.test(query)) {
    return noPreference;
  }
  const goals = [
    [/\b(?:nhanh nhat|uu tien thoi gian|fastest)\b/, 'fastest'],
    [/\b(?:ngan nhat|uu tien quang duong|shortest)\b/, 'shortest'],
    [/\b(?:it re(?: hon)?|giam so lan re|fewer turns|fewest turns)\b/, 'fewest-turns'],
  ] as const;
  if (/\b(?:khong can|khong muon|khong uu tien|don.t|do not)\b/.test(query)) return noPreference;
  const matched = goals.filter(([pattern]) => pattern.test(query));
  if (matched.length !== 1) return noPreference;

  const limit = /(?:toi da|khong qua|at most|up to)\s*(\d+(?:[.,]\d+)?)\s*(?:phut|minutes?)\b/i.exec(query);
  const hasTimeConstraint = /\b(?:toi da|khong qua|phut|minutes?|at most|up to)\b/.test(query);
  // Only accept numbers in a clearly stated additional-time limit.
  const hasExtraTime = /\b(?:them|extra|longer|additional)\b/.test(query);
  if ((hasTimeConstraint || /\d/.test(query)) && (!limit || !hasExtraTime)) return noPreference;
  const maxExtraMinutes = limit ? Number(limit[1]!.replace(',', '.')) : null;
  if (maxExtraMinutes !== null && maxExtraMinutes > 180) return noPreference;
  return { goal: matched[0]![1], maxExtraMinutes };
}

export function rankRouteComparison(
  routes: readonly [RouteComparisonFact, ...RouteComparisonFact[]],
  preference: RoutePreference,
  source: RouteComparisonResult['source'],
): RouteComparisonResult {
  const baseline = routes.reduce((best, route) =>
    route.durationSeconds < best.durationSeconds ? route : best,
  );
  const initial = { source, preference, baselineId: baseline.id, recommendedId: null, evidence: [] };
  if (!preference.goal) return { ...initial, status: 'clarify' };
  if (routes.length === 1) return { ...initial, status: 'single-route' };

  const limit = preference.maxExtraMinutes;
  const eligible = routes.filter(
    (route) => limit === null || route.durationSeconds - baseline.durationSeconds <= limit * 60,
  );
  if (preference.goal === 'fewest-turns' && eligible.some((route) => route.turnCount === null)) {
    return { ...initial, status: 'unknown-turns' };
  }
  const metric = (route: RouteComparisonFact) => {
    switch (preference.goal) {
      case 'shortest':
        return route.distanceMeters;
      case 'fewest-turns':
        return route.turnCount ?? Infinity;
      default:
        return route.durationSeconds;
    }
  };
  const optimum = Math.min(...eligible.map(metric));
  const best = eligible.filter((route) => metric(route) === optimum);
  // The fastest route always meets a nonnegative time cap. If the cap eliminates
  // every improvement on the requested metric, ask the user whether to relax it.
  if (limit !== null && optimum >= metric(baseline) && routes.some((route) => metric(route) < optimum)) {
    return { ...initial, status: 'no-match' };
  }
  if (best.length > 1) return { ...initial, status: 'equivalent' };
  const winner = best[0]!;

  const evidence: RouteComparisonResult['evidence'] = [
    { id: 'duration', delta: winner.durationSeconds - baseline.durationSeconds },
    { id: 'distance', delta: winner.distanceMeters - baseline.distanceMeters },
  ];
  if (winner.turnCount !== null && baseline.turnCount !== null) {
    evidence.push({ id: 'turns', delta: winner.turnCount - baseline.turnCount });
  }
  return { ...initial, status: 'recommended', recommendedId: winner.id, evidence };
}
