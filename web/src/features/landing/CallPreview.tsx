import { useId } from 'react';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { cx } from '../../design/cx.ts';
import { Avatar } from '../../design/primitives/Avatar.tsx';
import { StateBadge } from '../../design/primitives/Badge.tsx';
import { ProductIcon } from '../../design/primitives/ProductIcon.tsx';
import { ScoreBar } from '../../design/primitives/ScoreBar.tsx';
import { StatusBadge } from '../../design/primitives/StatusBadge.tsx';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '../../design/primitives/Tabs.tsx';
import { PREVIEW_CALLS, type PreviewCall } from './preview-data.ts';
import './call-preview.css';

// A real moment from a call, built from the same components as the call and the report: who is
// speaking and how they feel, the Microsoft product, the words so far and a first look at the
// coaching. The three products are tabs; the panels sit in one cell, so choosing a tab crossfades
// and nothing below moves. The waveform swings gently for a few seconds when a panel appears and
// then rests, so nothing on the page moves for long enough to need a pause control.

const STEP = 8;
const BAR = 4;
const HEIGHT = 40;

function Waveform({ bars }: { bars: readonly number[] }) {
  const width = bars.length * STEP - (STEP - BAR);
  return (
    <svg
      className="cp__wave"
      viewBox={`0 0 ${width} ${HEIGHT}`}
      aria-hidden="true"
      focusable="false"
    >
      {bars.map((value, index) => {
        const height = 4 + (value / 100) * (HEIGHT - 8);
        return (
          <rect
            key={index}
            className="cp__bar"
            x={index * STEP}
            y={(HEIGHT - height) / 2}
            width={BAR}
            height={height}
            rx={BAR / 2}
          />
        );
      })}
    </svg>
  );
}

function Call({ call }: { call: PreviewCall }) {
  return (
    <div className="cp__call">
      <div className="cp__top">
        <p className="cp__product">
          <ProductIcon product={call.product} size={18} />
          <span>{call.productName}</span>
        </p>
        <StatusBadge label="Customer speaking" tone="info" icon="speaker" size="small" />
      </div>

      <div className="cp__person">
        <span className="cp__avatar">
          <Avatar name={call.customer.name} size="lg" />
        </span>
        <div className="cp__who">
          <p className="cp__name">{call.customer.name}</p>
          <p className="cp__role">{call.customer.role}</p>
        </div>
        <StateBadge state={call.state} />
      </div>

      <Waveform bars={call.wave} />

      <ol className="cp__turns" role="list">
        {call.turns.map((turn) => (
          <li key={turn.time} className={cx('cp__turn', turn.speaker === 'you' && 'cp__turn--you')}>
            <p className="cp__meta">
              <span className="cp__speaker">
                {turn.speaker === 'you' ? 'You' : call.customer.name}
              </span>{' '}
              <span>{turn.time}</span>
            </p>
            <p className="cp__text">{turn.text}</p>
          </li>
        ))}
      </ol>

      <div className="cp__coaching">
        <p className="cp__label">After the call</p>
        <ul className="cp__scores" role="list">
          {call.scores.map(({ id, score }) => (
            <li key={id} className="cp__score">
              <span className="cp__skill">{DIMENSIONS[id].short}</span>
              <ScoreBar score={score} size="small" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function CallPreview() {
  const captionId = useId();
  return (
    <figure className="cp" aria-labelledby={captionId}>
      <Tabs defaultValue={PREVIEW_CALLS[0]?.id}>
        <TabList label="Example calls by product" className="cp__tabs">
          {PREVIEW_CALLS.map((call) => (
            <Tab key={call.id} value={call.id}>
              {call.tab}
            </Tab>
          ))}
        </TabList>
        <div className="cp__window">
          <TabPanels>
            {PREVIEW_CALLS.map((call) => (
              <TabPanel key={call.id} value={call.id} stacked className="cp__panel">
                <Call call={call} />
              </TabPanel>
            ))}
          </TabPanels>
        </div>
      </Tabs>
      <figcaption id={captionId} className="cp__caption">
        Example call. The customer is synthetic.
      </figcaption>
    </figure>
  );
}
