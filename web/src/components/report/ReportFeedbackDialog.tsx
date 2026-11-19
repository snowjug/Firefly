import { useId, useState } from 'react';
import { Link } from 'react-router';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIMENSION_IDS, DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { useToast } from '../../lib/toast.tsx';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';
import { copyText } from './CopyButton.tsx';
import { feedbackNote, issueUrl } from './labels.ts';

interface FeedbackTarget {
  sessionId: string;
  evaluator: CoachingReport['evaluator'];
  /** How many turns the call had, to check the turn number someone types. */
  turnCount: number;
}

function FeedbackForm({ sessionId, evaluator, turnCount }: FeedbackTarget) {
  const { toast } = useToast();
  const uid = useId();
  const [skill, setSkill] = useState<DimensionId | ''>('');
  const [turnText, setTurnText] = useState('');

  const typed = turnText.trim();
  const turn = /^\d+$/.test(typed) ? Number(typed) : null;
  const turnProblem =
    typed !== '' && (turn === null || turn < 1 || (turnCount > 0 && turn > turnCount));
  const note = feedbackNote({
    sessionId,
    skill: skill || null,
    turn: turnProblem ? null : turn,
    evaluator,
  });

  const copy = async () => {
    const ok = await copyText(note);
    toast(
      ok
        ? {
            tone: 'positive',
            title: 'Copied',
            message:
              'Paste it into a message to your mentor. It holds no part of the conversation.',
          }
        : {
            tone: 'negative',
            title: 'Could not copy',
            message: 'Select the note below and copy it by hand.',
          },
    );
  };

  return (
    <div className="rp-fb">
      <div className="rp-fb-fields">
        <div className="field">
          <label className="label" htmlFor={`${uid}-skill`}>
            Which skill looks wrong?
          </label>
          <select
            id={`${uid}-skill`}
            className="select"
            value={skill}
            onChange={(event) => setSkill(event.target.value as DimensionId | '')}
            data-autofocus
          >
            <option value="">Not sure (the whole report)</option>
            {DIMENSION_IDS.map((id) => (
              <option key={id} value={id}>
                {DIMENSIONS[id].label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor={`${uid}-turn`}>
            Turn number
          </label>
          <input
            id={`${uid}-turn`}
            className="input"
            inputMode="numeric"
            autoComplete="off"
            value={turnText}
            onChange={(event) => setTurnText(event.target.value)}
            aria-invalid={turnProblem ? 'true' : undefined}
            aria-describedby={`${uid}-turn-hint`}
          />
        </div>
        <p id={`${uid}-turn-hint`} className={turnProblem ? 'field-error' : 'hint'}>
          {turnProblem
            ? `Use a whole number from 1 to ${turnCount}.`
            : 'The turn number is optional. Every quote in the report shows its turn.'}
        </p>
      </div>

      <div className="field">
        <label className="label" htmlFor={`${uid}-note`}>
          The note you will copy
        </label>
        <textarea
          id={`${uid}-note`}
          className="textarea mono"
          rows={5}
          readOnly
          value={note}
          aria-describedby={`${uid}-note-hint`}
        />
        <p id={`${uid}-note-hint`} className="hint">
          It names the call, skill and turn. It never includes the words of the conversation.
        </p>
      </div>

      <button type="button" className="btn btn-primary" onClick={copy}>
        <Icon name="copy" size={18} /> Copy a note for your mentor
      </button>

      <div className="divider" />

      <div className="rp-fb-public">
        <p className="t-label">Or tell the Firefly team</p>
        <div className="callout callout-caution" role="note">
          <Icon name="alert" size={18} />
          <p>
            A GitHub issue is public. Never paste real customer information into it. Firefly&rsquo;s
            scenarios are fictional, so there is nothing real to share.
          </p>
        </div>
        <div className="cluster">
          <a
            className="btn btn-secondary"
            href={issueUrl(note)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open an issue on GitHub
            <span className="sr-only"> (opens in a new tab)</span>
            <Icon name="external" size={16} />
          </a>
        </div>
        <p className="t-small t-muted">
          Mentors can compare this report with their own scores on the{' '}
          <Link to="/calibration">calibration page</Link>.
        </p>
      </div>
    </div>
  );
}

/** "Report incorrect feedback": a way to flag a report without sharing the conversation itself. */
export function ReportFeedbackButton(props: FeedbackTarget) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        <Icon name="flag" size={18} /> Report incorrect feedback
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Report incorrect feedback"
        description="Automatic feedback can be wrong. If something in this report looks incorrect, unfair or confusing, tell your mentor or the Firefly team, without sharing the conversation."
      >
        <FeedbackForm {...props} />
      </Dialog>
    </>
  );
}
