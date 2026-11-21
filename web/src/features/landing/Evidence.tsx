import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { Icon } from '../../design/icons.tsx';
import { Tag } from '../../design/primitives/Badge.tsx';
import { LandingSection } from './LandingSection.tsx';
import { EVIDENCE } from './landing-copy.ts';

/** One piece of evidence: what the trainee said, and what the coaching made of it. */
export function Evidence() {
  return (
    <LandingSection id="evidence" title="Coaching evidence">
      <div className="lp-evidence">
        <div className="lp-evidence__part">
          <p className="lp-evidence__label">You said</p>
          <blockquote className="lp-evidence__quote">&ldquo;{EVIDENCE.said}&rdquo;</blockquote>
        </div>
        <Icon name="arrow-right" size={20} className="lp-evidence__arrow" />
        <div className="lp-evidence__part">
          <p className="lp-evidence__label">Coaching</p>
          <p className="lp-evidence__coaching">{EVIDENCE.coaching}</p>
          <Tag size="small">{DIMENSIONS[EVIDENCE.skill].label}</Tag>
        </div>
      </div>
    </LandingSection>
  );
}
