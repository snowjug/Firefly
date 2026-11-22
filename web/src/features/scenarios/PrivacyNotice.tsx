import { useEffect, useRef } from 'react';
import { Icon } from '../../design/icons.tsx';
import { mergeRefs } from '../../design/interaction/merge-refs.ts';
import { useReveal } from '../../design/interaction/use-reveal.ts';
import { Button } from '../../design/primitives/Button.tsx';
import { Disclosure } from '../../design/primitives/Disclosure.tsx';
import { MICROPHONE_NOTICE, PRIVACY_DETAILS_LABEL, type NoticeDetail } from './privacy.ts';

export interface PrivacyNoticeProps {
  /** What happens to the microphone, the audio and the transcript, for the way speech works here. */
  details: readonly NoticeDetail[];
  /**
   * Show the sentence about the microphone, with a way to say it has been read: for a spoken call
   * that has not been read about yet. Otherwise it is only a closed row, so the details are never
   * more than a press away.
   */
  introduce: boolean;
  onAcknowledge(): void;
}

function Details({ details }: { details: readonly NoticeDetail[] }) {
  return (
    <ul className="brf-details" role="list">
      {details.map((detail) => (
        <li key={detail.id}>
          <strong className="brf-details__label">{detail.label}</strong>
          {detail.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * Before the first spoken call: one sentence about the microphone, with the details behind it and a
 * way to say it has been read. Afterwards, and for a call that is only typed, a closed row. It only
 * tells: nothing here opens the microphone. Whichever it is, it rises into place the first time it
 * scrolls into view, and stays in place when it turns into the closed row.
 */
export function PrivacyNotice({ details, introduce, onAcknowledge }: PrivacyNoticeProps) {
  const row = useRef<HTMLElement>(null);
  const readIt = useRef(false);
  const [seen, reveal] = useReveal<HTMLElement>();

  // "Got it" removes the button that has focus. The notice has become a closed row, so focus goes to
  // the row, which is where the details went, instead of falling back to the top of the page.
  useEffect(() => {
    if (introduce || !readIt.current) return;
    readIt.current = false;
    row.current?.querySelector('button')?.focus();
  }, [introduce]);

  if (!introduce) {
    return (
      <div ref={mergeRefs(row, seen)} {...reveal}>
        <Disclosure
          summary={PRIVACY_DETAILS_LABEL}
          icon="shield"
          headingLevel={3}
          className="brf-privacy"
        >
          <Details details={details} />
        </Disclosure>
      </div>
    );
  }
  return (
    <section ref={seen} {...reveal} className="brf-notice" aria-label="Privacy notice">
      <Icon name="shield" size={20} className="brf-notice__icon" />
      <div className="brf-notice__body">
        <p className="brf-notice__text">{MICROPHONE_NOTICE}</p>
        <Disclosure summary={PRIVACY_DETAILS_LABEL} headingLevel={3} appearance="inline">
          <Details details={details} />
        </Disclosure>
      </div>
      <Button
        size="small"
        appearance="outline"
        onClick={() => {
          readIt.current = true;
          onAcknowledge();
        }}
      >
        Got it
      </Button>
    </section>
  );
}
