import { memo, useState } from 'react';
import { captionWords, type Caption } from './call-model.ts';
import { Crossfade } from './Crossfade.tsx';
import './captions.css';

export interface CaptionsProps {
  /** What is said now, or null between turns: the strip fades out and keeps its place. */
  caption: Caption | null;
  /** The customer's name, over their words. The trainee's are labelled "You". */
  customerName: string;
}

/**
 * Live captions under the customer: the customer's line while it is spoken, and the trainee's own
 * words as they speak, each word settling in as it arrives. It is not chat: no bubbles, no history
 * (the transcript is the record), and between turns the strip fades away and keeps its height, so
 * nothing on the screen moves. It says nothing to assistive technology, because the words change
 * constantly and the transcript log announces each finished turn once. Only opacity and transform
 * ever move.
 */
export const Captions = memo(function Captions({ caption, customerName }: CaptionsProps) {
  // The last caption stays drawn while the strip fades out, so words never vanish before they have faded.
  const [shown, setShown] = useState<Caption | null>(caption);
  if (caption && (shown?.key !== caption.key || shown.text !== caption.text)) setShown(caption);

  return (
    <div
      className="cw-captions"
      data-live={caption !== null}
      data-who={shown?.who ?? 'customer'}
      aria-hidden="true"
    >
      {shown ? (
        <Crossfade id={shown.key}>
          <span className="cw-captions__line">
            <span className="cw-captions__who">{shown.who === 'you' ? 'You' : customerName}</span>
            <span className="cw-captions__body">
              <span className="cw-captions__text" dir="auto">
                {captionWords(shown.text).map((word, index) => (
                  <span key={`${index}:${word}`} className="cw-captions__word">
                    {word}{' '}
                  </span>
                ))}
              </span>
            </span>
          </span>
        </Crossfade>
      ) : null}
    </div>
  );
});
