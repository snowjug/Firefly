import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_RANK, type ProductId } from '#shared/domain/vocab.ts';
import { FEATURED_PRODUCTS } from './landing-copy.ts';

/** The most cards the featured row shows. */
export const FEATURED_MAX = 12;

/**
 * The scenarios the landing page features: one for each product, in the order the products are
 * listed, so the row is as varied as the library is. Where a product has several, the gentlest one
 * (the lowest difficulty, then the first by id) leads, so a first visit meets an approachable call.
 * Nothing is repeated. If the library has none of those products (it should not happen), the first
 * scenarios as they came are shown instead, so the row is never empty when there is something to show.
 */
export function pickFeatured(
  scenarios: readonly PublicScenarioDTO[],
  products: readonly ProductId[] = FEATURED_PRODUCTS,
): PublicScenarioDTO[] {
  const picked: PublicScenarioDTO[] = [];
  for (const product of products) {
    const own = scenarios
      .filter((scenario) => scenario.product.id === product)
      .sort(
        (a, b) =>
          DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || a.id.localeCompare(b.id),
      );
    const first = own[0];
    if (first) picked.push(first);
  }
  const unique = [...new Map(picked.map((scenario) => [scenario.id, scenario])).values()];
  return (unique.length > 0 ? unique : [...scenarios]).slice(0, FEATURED_MAX);
}
