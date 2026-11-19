import type { CalibrationRecordDTO } from '#shared/domain/api.ts';
import type { CalibrationMetrics } from '#shared/domain/calibration.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { percent, plural } from '../../lib/format.ts';
import { Icon } from '../Icon.tsx';
import { biasLabel, overallBiasSentence, readBias, sampleSizeMessage, signed } from './bias.ts';

const versionsText = (label: string, values: string[]) =>
  values.length === 0
    ? null
    : `${label} ${values.length === 1 ? 'version' : 'versions'} ${values.join(', ')}`;

/** Figures computed from stored reviews only, always introduced by how many sessions they rest on. */
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
    <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-5)' }}>
      <div className={`callout cal-size${size.band === 'moderate' ? '' : ' callout-caution'}`}>
        <Icon name="info" size={20} />
        <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-1)' }}>
          <p className="cal-size-title">{size.text}.</p>
          <p>{metrics.caveat}</p>
        </div>
      </div>

      {overall ? (
        <dl className="cal-stats">
          <div className="cal-stat">
            <dt>Sessions reviewed</dt>
            <dd className="cal-stat-value tabular">{metrics.sessions}</dd>
            <dd className="cal-stat-note">
              {plural(records.length, 'review')}, {plural(metrics.scores, 'skill score')} compared
            </dd>
          </div>
          <div className="cal-stat">
            <dt>Average difference</dt>
            <dd className="cal-stat-value tabular">
              {overall.meanAbsoluteDifference.toFixed(1)}
              <span className="cal-stat-unit"> points</span>
            </dd>
            <dd className="cal-stat-note">
              How far apart the AI and mentor scores are on the 1 to 5 scale. 0 would mean the same
              scores.
            </dd>
          </div>
          <div className="cal-stat">
            <dt>Within 1 point</dt>
            <dd className="cal-stat-value tabular">{percent(overall.withinOne)}</dd>
            <dd className="cal-stat-note">
              Share of skill scores where the AI and the mentor are no more than 1 point apart.
            </dd>
          </div>
          <div className="cal-stat">
            <dt>Overall lean</dt>
            <dd className="cal-stat-value cal-stat-text">
              {lean ? biasLabel(lean, overall.bias) : ''}
            </dd>
            <dd className="cal-stat-note">
              {lean ? overallBiasSentence(lean, overall.bias) : ''} Bias is the average of AI score
              minus mentor score
              {lean && (lean.kind === 'none' || lean.kind === 'too-few')
                ? ` (${signed(overall.bias)} here)`
                : ''}
              .
            </dd>
          </div>
        </dl>
      ) : null}

      {metrics.perDimension.length > 0 ? (
        <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
          <h3 className="t-body cal-subhead">Agreement by skill</h3>
          <div
            className="table-wrap cal-table-wrap"
            role="region"
            aria-label="Agreement by skill"
            // A scrolling region has to be reachable from the keyboard.
            tabIndex={0}
          >
            <table className="table cal-table">
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
                        <span className="t-meta">{plural(row.n, 'review')}</span>
                      </th>
                      <td className="tabular">{row.meanAbsoluteDifference.toFixed(1)}</td>
                      <td>
                        <span className="cal-within">
                          <span className="cal-bar" aria-hidden="true">
                            <span style={{ width: `${Math.round(row.withinOne * 100)}%` }} />
                          </span>
                          <span className="tabular">{percent(row.withinOne)}</span>
                        </span>
                      </td>
                      <td className={reading.kind === 'too-few' ? 'cal-muted' : undefined}>
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

      <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-2)' }}>
        {versions.length > 0 ? (
          <p className="t-meta">
            Compared using {versions.join(' and ')}.
            {mixedVersions ? ' The figures combine reviews made with more than one version.' : ''}
          </p>
        ) : null}
        {sampleRecords > 0 ? (
          <p className="t-meta">
            Includes {plural(sampleRecords, 'sample record')}. Sample records compare the AI with
            synthetic mentor scores written for the sample data, so they show how this page works,
            not how a person would score.
          </p>
        ) : null}
      </div>
    </div>
  );
}
