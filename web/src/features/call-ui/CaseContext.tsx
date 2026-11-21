import { memo, type ReactNode } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import { Disclosure, Field, ProductIcon, Tag, TextArea } from '../../design/index.ts';
import { describeCase } from './call-model.ts';
import './case.css';

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cw-case__item">
      <dt className="cw-case__label">{label}</dt>
      <dd className="cw-case__value">{children}</dd>
    </div>
  );
}

export interface CaseBodyProps {
  session: SessionDTO;
  /** How many things the trainee has found out so far. A count, never a total, and never what they are. */
  found: number;
  /** Guided practice shows the areas worth exploring; a standard call does not. */
  guided: boolean;
  notes: string;
  onNotes(text: string): void;
}

/**
 * The case, so it can be read again while the call happens: the product, a made-up case reference,
 * the issue, the impact, the call stage and the objective, with the rest of the public brief behind
 * "More context". It is drawn from what the trainee was told before the call, so it never holds a
 * hidden fact. The private notes are the trainee's own: they stay in this page, are not saved and
 * are not seen by the customer or the evaluator.
 */
export const CaseBody = memo(function CaseBody({
  session,
  found,
  guided,
  notes,
  onNotes,
}: CaseBodyProps) {
  const { scenario } = session;
  const facts = describeCase(scenario);
  return (
    <>
      <dl className="cw-case__list">
        {facts.product && scenario.product ? (
          <Item label="Product">
            <span className="cw-case__product">
              <ProductIcon product={scenario.product.id} size={18} />
              {facts.product.name}
            </span>
            <span className="cw-case__muted">{facts.product.area}</span>
          </Item>
        ) : null}
        {facts.caseReference ? (
          <Item label="Case">
            <span className="cw-case__ref">{facts.caseReference}</span>
            <Tag size="small">Synthetic</Tag>
          </Item>
        ) : null}
        {facts.issue ? <Item label="Issue">{facts.issue}</Item> : null}
        <Item label="Impact">
          <strong>{facts.impact.label}</strong>
          <span className="cw-case__muted">{facts.impact.detail}</span>
        </Item>
        <Item label="Call stage">{facts.callStage}</Item>
        <Item label="Objective">{facts.objective}</Item>
        <Item label="Context found">
          <span className="cw-case__count">{found}</span>
        </Item>
        {guided && scenario.expectedDiscoveryAreas.length > 0 ? (
          <Item label="Areas to explore">
            <ul className="cw-case__areas">
              {scenario.expectedDiscoveryAreas.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </Item>
        ) : null}
      </dl>
      {facts.more.length > 0 ? (
        <Disclosure appearance="inline" summary="More context">
          <dl className="cw-case__list">
            {facts.more.map((row) => (
              <Item key={row.label} label={row.label}>
                {row.text}
              </Item>
            ))}
          </dl>
        </Disclosure>
      ) : null}
      <Field label="Private notes" hint="Only on this screen. Not saved or scored.">
        <TextArea
          rows={4}
          value={notes}
          className="cw-case__notes"
          onChange={(event) => onNotes(event.currentTarget.value)}
        />
      </Field>
    </>
  );
});

export interface CaseContextProps extends CaseBodyProps {
  titleId: string;
}

/**
 * The case column on wide screens. Narrower screens show the same body in a sheet. The column scrolls
 * on its own, so the scrolling area is the focusable, named region: a keyboard user can scroll it.
 */
export const CaseContext = memo(function CaseContext({ titleId, ...body }: CaseContextProps) {
  return (
    <div className="cw-case">
      <h2 className="cw-case__title" id={titleId}>
        Case
      </h2>
      <div className="cw-case__scroll" role="region" aria-labelledby={titleId} tabIndex={0}>
        <CaseBody {...body} />
      </div>
    </div>
  );
});
