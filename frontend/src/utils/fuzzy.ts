/**
 * Lightweight, dependency-free fuzzy matching for combobox/search inputs.
 *
 * Matching is case-insensitive and accepts both:
 *   - contiguous substring matches ("mouse" matches "Wireless Mouse")
 *   - subsequence matches ("pdt" matches "Product", "wl mse" matches "Wireless Mouse")
 *
 * `fuzzyScore` returns -1 for no match, otherwise a score where higher is a
 * better match (exact > prefix > substring > subsequence), so callers can
 * rank results with looser fuzzy hits surfacing below obvious ones.
 */

export function fuzzyMatch(label: string, query: string): boolean {
  return fuzzyScore(label, query) >= 0;
}

export function fuzzyScore(label: string, query: string): number {
  const text = label.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  if (text === q) return 1000;
  if (text.startsWith(q)) return 800;
  const idx = text.indexOf(q);
  if (idx !== -1) return 600 - idx;

  // Subsequence match: every query char must appear in order, but not
  // necessarily contiguously. Contiguous runs are rewarded so "mouse"
  // ranks above "m...o...u...s...e".
  let i = 0;
  let score = 0;
  let streak = 0;
  for (const ch of text) {
    if (i < q.length && ch === q[i]) {
      streak += 1;
      score += 1 + streak;
      i += 1;
    } else {
      streak = 0;
    }
    if (i === q.length) break;
  }
  return i === q.length ? score : -1;
}
