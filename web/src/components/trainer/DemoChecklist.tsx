import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { checklistSteps, readTicks, writeTicks } from './checklist-model.ts';
import { StudioSection } from './StudioFrame.tsx';

/**
 * A short "what to show" list for a live demo, with links to the places that need one. The
 * presenter ticks a step when it has been shown; the ticks are theirs, kept for this tab only, and
 * every step says "Done" or "Not yet" in words as well as in its mark.
 */
export function DemoChecklist({ spotlightId }: { spotlightId: string | null }) {
  const base = useId();
  const steps = useMemo(() => checklistSteps(spotlightId), [spotlightId]);
  const ids = useMemo(() => steps.map((step) => step.id), [steps]);
  const [ticked, setTicked] = useState(() => readTicks(ids));

  const change = (next: string[]) => {
    const ordered = ids.filter((id) => next.includes(id));
    setTicked(ordered);
    writeTicks(ordered);
  };
  const toggle = (id: string, on: boolean) =>
    change(on ? [...ticked, id] : ticked.filter((tick) => tick !== id));

  return (
    <StudioSection
      title="Demo checklist"
      about="A suggested order for showing the product end to end."
    >
      <div className="tr-checklist">
        <div className="tr-checklist__bar">
          <p className="tr-checklist__count type-label">
            {ticked.length} of {steps.length} done
          </p>
          {ticked.length > 0 ? (
            <button type="button" className="text-link" onClick={() => change([])}>
              Clear the ticks
            </button>
          ) : null}
        </div>

        <ol className="tr-steps">
          {steps.map((step, index) => {
            const done = ticked.includes(step.id);
            const titleId = `${base}-${step.id}-title`;
            const textId = `${base}-${step.id}-text`;
            return (
              <li key={step.id} className="tr-step" data-done={done ? '' : undefined}>
                <span className="tr-step__num" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="tr-step__body">
                  <p id={titleId} className="tr-step__title">
                    {step.title}
                  </p>
                  <p id={textId} className="tr-step__text">
                    {step.text}
                  </p>
                  {step.links ? (
                    <p className="tr-step__links">
                      {step.links.map((link) => (
                        <Link key={link.to} to={link.to} className="text-link" viewTransition>
                          {link.label}
                        </Link>
                      ))}
                    </p>
                  ) : null}
                </div>
                <label className="tr-check">
                  <input
                    type="checkbox"
                    checked={done}
                    aria-labelledby={titleId}
                    aria-describedby={textId}
                    onChange={(event) => toggle(step.id, event.target.checked)}
                  />
                  <span className="tr-check__mark" aria-hidden="true" />
                  <span className="tr-check__state" aria-hidden="true">
                    {done ? 'Done' : 'Not yet'}
                  </span>
                </label>
              </li>
            );
          })}
        </ol>

        <p className="tr-aside">
          <strong>Unscripted by design.</strong> There are no canned answers for any anticipated
          conversation. The only pre-written content is the sample sessions, and those are always
          labelled Sample.
        </p>
      </div>
    </StudioSection>
  );
}
