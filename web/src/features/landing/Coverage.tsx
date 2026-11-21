import { ProductIcon } from '../../design/primitives/ProductIcon.tsx';
import { LandingSection } from './LandingSection.tsx';
import { COVERAGE } from './landing-copy.ts';

/** The Microsoft products Firefly practises: a name and a neutral mark each, not logos. */
export function Coverage() {
  return (
    <LandingSection id="products" title="Microsoft products" quiet>
      <ul className="lp-products" role="list">
        {COVERAGE.map(({ product, label }) => (
          <li key={product} className="lp-product">
            <span className="lp-product__icon">
              <ProductIcon product={product} size={20} />
            </span>
            {label}
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}
