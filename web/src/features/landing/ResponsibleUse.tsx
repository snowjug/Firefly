import type { ReactNode } from 'react';
import { Icon, TextLink } from '../../design/index.ts';
import { Band } from './Band.tsx';

// "employee-performance" stays on one line: a hyphen is a place to break, and "employee-" alone at
// the end of a line reads badly in the one sentence that matters most.
const STATEMENTS: readonly { key: string; text: ReactNode }[] = [
  {
    key: 'fictional',
    text: 'Fictional customers and scenarios only. Never enter real customer information.',
  },
  {
    key: 'training-aid',
    text: (
      <>
        Firefly is a training aid. Scores are for coaching practice, not{' '}
        <span className="u-nowrap">employee-performance</span> assessment.
      </>
    ),
  },
  {
    key: 'ai-feedback',
    text: 'AI-generated feedback can be incomplete or wrong. Treat it as a starting point for a conversation with a mentor.',
  },
  {
    key: 'audio',
    text: 'Firefly does not store your audio. Speech is turned into text and the audio is discarded.',
  },
];

export function ResponsibleUse() {
  return (
    <Band id="responsible-use">
      <div className="lp-panel">
        <div className="lp-panel__head">
          <Icon name="shield" size={32} className="lp-panel__icon" />
          <h2 id="responsible-use-title" className="lp-title">
            Responsible use
          </h2>
        </div>
        <ul role="list" className="lp-panel__list">
          {STATEMENTS.map((statement) => (
            <li key={statement.key} className="lp-panel__item">
              {statement.text}
            </li>
          ))}
        </ul>
        <p className="lp-panel__more">
          Where speech is processed depends on your browser and on how Firefly is set up.{' '}
          <TextLink to="/responsible-ai">How Firefly uses AI and speech</TextLink>
        </p>
      </div>
    </Band>
  );
}
