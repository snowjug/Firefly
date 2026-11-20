import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { formatWhen } from './trail-model.ts';
import { Dialog } from '../Dialog.tsx';
import { scoreText } from '../report/labels.ts';
import '../../styles/history.css';

const MINUS = '\u2212';

/** "+1 higher", "same" or "\u22121 lower": a difference always spelled out in text. */
export function differenceText(earlier: number | undefined, later: number | undefined): string {
  if (earlier === undefined || later === undefined) return '\u2013';
  const diff = Math.round((later - earlier) * 10) / 10;
  if (diff === 0) return 'same';
  const size = scoreText(Math.abs(diff));
  return diff > 0 ? `+${size} higher` : `${MINUS}${size} lower`;
}

function caution(a: SessionSummaryDTO, b: SessionSummaryDTO): string {
  const differences: string[] = [];
  if (a.scenarioId !== b.scenarioId) differences.push('different scenarios');
  if (a.difficulty !== b.difficulty) {
    differences.push(
      `different difficulty levels (${DIFFICULTY_PROFILES[a.difficulty].label} and ${DIFFICULTY_PROFILES[b.difficulty].label})`,
    );
  }
  return differences.length > 0
    ? `These two calls used ${differences.join(' and ')}, so the scores are not like for like. Use the differences as a prompt for reflection, not as a measure of progress.`
    : 'Both calls used the same scenario and difficulty. Scores can still vary from call to call, so treat the differences as a prompt for reflection.';
}

/** A side-by-side of two completed calls: six skill scores, both overall scores and the change. */
export function CompareDialog({
  sessions,
  onClose,
}: {
  sessions: readonly [SessionSummaryDTO, SessionSummaryDTO] | null;
  onClose(): void;
}) {
  const ordered = sessions
    ? [...sessions].sort((x, y) => Date.parse(x.startedAt) - Date.parse(y.startedAt))
    : null;
  const earlier = ordered?.[0];
  const later = ordered?.[1];
  return (
    <Dialog open={ordered !== null} onClose={onClose} title="Compare two calls" eyebrow="History">
      {earlier && later ? (
        <div className="trail-dialog">
          <p className="trail-caution" role="note">
            {caution(earlier, later)}
          </p>
          <dl className="trail-compare-who">
            {[
              { label: 'Earlier call', session: earlier },
              { label: 'Later call', session: later },
            ].map(({ label, session }) => (
              <div key={session.id}>
                <dt className="type-label">{label}</dt>
                <dd>
                  <strong>{session.scenarioTitle}</strong>
                  <span>
                    {DIFFICULTY_PROFILES[session.difficulty].label} &middot;{' '}
                    {formatWhen(session.startedAt)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <table className="trail-compare">
            <caption className="sr-only">Skill scores out of 5 for the two calls</caption>
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Earlier</th>
                <th scope="col">Later</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSION_IDS.map((id) => (
                <tr key={id}>
                  <th scope="row">{DIMENSIONS[id].short}</th>
                  <td>{earlier.dimensionScores?.[id] ?? '\u2013'}</td>
                  <td>{later.dimensionScores?.[id] ?? '\u2013'}</td>
                  <td>
                    {differenceText(earlier.dimensionScores?.[id], later.dimensionScores?.[id])}
                  </td>
                </tr>
              ))}
              <tr className="trail-compare__overall">
                <th scope="row">Overall</th>
                <td>
                  {earlier.overallScore === null ? '\u2013' : scoreText(earlier.overallScore)}
                </td>
                <td>{later.overallScore === null ? '\u2013' : scoreText(later.overallScore)}</td>
                <td>
                  {differenceText(
                    earlier.overallScore ?? undefined,
                    later.overallScore ?? undefined,
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="action-row trail-dialog__actions">
            <button type="button" className="action action--quiet" onClick={onClose} data-autofocus>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
