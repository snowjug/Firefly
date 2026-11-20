import type { CalibrationRecordDTO } from '#shared/domain/api.ts';
import type { CalibrationMetrics } from '#shared/domain/calibration.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { percent, plural } from '../../lib/format.ts';
import { Stat, StatRow } from '../trainer/bridge.tsx';
import { biasLabel, overallBiasSentence, readBias, sampleSizeMessage, signed } from './bias.ts';

const versionsText = (label: string, values: string[]) =>
  values.length === 0
    ? null
    : `${label} ${values.length === 1 ? 'version' : 'versions'} ${values.join(', ')}`;

/**
 * Figures computed from stored reviews only, always introduced by how many sessions they rest on
 * and, when that is not many, by a plain statement that they are not enough. Nothing is invented:
 * every figure here is the server's, and the lean is only described once enough sessions support it.
 */
export function MetricsPanel({
  metrics,
  records,
}: {
  metrics: CalibrationMetrics;
  records: CalibrationRecordDTO[];
}) {
  const size = sampleSizeMessage(metrics.sessions);
  const { overall } = metrics;
  const lean = overall ? readBias(overall.bias, metrics.sessions) : null;
  const sampleRecords = records.filter((record) => record.source === 'sample').length;
  const versions = [
    versionsText('evaluator', metrics.evaluatorVersions),
    versionsText('rubric', metrics.rubricVersions),
  ].filter(Boolean);
  const mixedVersions = metrics.evaluatorVersions.length > 1 || metrics.rubricVersions.length > 1;

  return (
    <div className="cal-metrics">
      <div className="cal-size" data-band={size.band}>
        <p className="cal-size__title">{size.text}.</p>
        <p className="cal-size__caveat">{metrics.caveat}</p>
      </div>

      {overall ? (
        <div className="cal-stats">
          <StatRow>
            <Stat
              label="Sessions reviewed"
              value={metrics.sessions}
              note={`${plural(records.length, 'review')}, ${plural(metrics.scores, 'skill score')} compared`}
            />
            <Stat
              label="Average difference"
              value={
                <>
                  {overall.meanAbsoluteDifference.toFixed(1)}
                  <span className="cal-unit"> points</span>
                </>
              }
              note="How far apart the AI and mentor scores are on the 1 to 5 scale. 0 would mean the same scores."
            />
            <Stat
              label="Within 1 point"
              value={percent(overall.withinOne)}
              note="Share of skill scores where the AI and the mentor are no more than 1 point apart."
            />
            <Stat
              label="Overall lean"
              value={<span className="cal-lean">{lean ? biasLabel(lean, overall.bias) : ''}</span>}
              note={`${lean ? overallBiasSentence(lean, overall.bias) : ''} Bias is the average of AI score minus mentor score${
                lean && (lean.kind === 'none' || lean.kind === 'too-few')
                  ? ` (${signed(overall.bias)} here)`
                  : ''
              }.`}
            />
          </StatRow>
        </div>
      ) : null}

      {metrics.perDimension.length > 0 ? (
        <div className="cal-block">
          <h3 className="cal-subhead">Agreement by skill</h3>
          <div
            className="cal-scroll"
            role="region"
            aria-label="Agreement by skill"
            // A scrolling region has to be reachable from the keyboard.
            tabIndex={0}
          >
            <table className="cal-table cal-skills">
              <caption className="sr-only">
                Agreement between AI and mentor scores for each of the six skills
              </caption>
              <thead>
                <tr>
                  <th scope="col">Skill</th>
                  <th scope="col">Average difference</th>
                  <th scope="col">Within 1 point</th>
                  <th scope="col">Bias</th>
                </tr>
              </thead>
              <tbody>
                {metrics.perDimension.map((row) => {
                  const reading = readBias(row.bias, row.n);
                  return (
                    <tr key={row.dimension}>
                      <th scope="row">
                        <span className="cal-skill">{DIMENSIONS[row.dimension].label}</span>
                        <span className="cal-meta">{plural(row.n, 'review')}</span>
                      </th>
                      <td data-label="Average difference" className="cal-num">
                        {row.meanAbsoluteDifference.toFixed(1)}
                      </td>
                      <td data-label="Within 1 point">
                        <span className="cal-within">
                          <span className="cal-bar" aria-hidden="true">
                            <span style={{ width: `${Math.round(row.withinOne * 100)}%` }} />
                          </span>
                          <span className="cal-num">{percent(row.withinOne)}</span>
                        </span>
                      </td>
                      <td
                        data-label="Bias"
                        className={reading.kind === 'too-few' ? 'cal-muted' : undefined}
                      >
                        {biasLabel(reading, row.bias)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {versions.length > 0 || sampleRecords > 0 ? (
        <div className="cal-notes">
          {versions.length > 0 ? (
            <p>
              Compared using {versions.join(' and ')}.
              {mixedVersions ? ' The figures combine reviews made with more than one version.' : ''}
            </p>
          ) : null}
          {sampleRecords > 0 ? (
            <p>
              Includes {plural(sampleRecords, 'sample record')}. Sample records compare the AI with
              synthetic mentor scores written for the sample data, so they show how this page works,
              not how a person would score.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
