import { LinkButton } from '../../design/index.ts';
import { Band } from './Band.tsx';
import { CALL_MINUTES } from './scenario-examples.ts';

export function FinalAction() {
  return (
    <Band id="start">
      <div className="lp-final">
        <div className="lp-final__text">
          <h2 id="start-title" className="lp-title">
            Begin your first simulated call
          </h2>
          <p className="lp-intro">
            A call takes between {CALL_MINUTES.min} and {CALL_MINUTES.max} minutes, depending on the
            scenario.
          </p>
        </div>
        <LinkButton to="/scenarios" appearance="primary" size="large">
          Start a simulation
        </LinkButton>
      </div>
    </Band>
  );
}
