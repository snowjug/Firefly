import { Link } from 'react-router';
import { TemperatureOrb } from '../TemperatureOrb.tsx';
import type { SettingRow } from './setup-model.ts';

interface SettingsSummaryProps {
  rows: readonly SettingRow[];
  /** Where each row can be changed. Leave out when the list is read-only. */
  editHref?: (row: SettingRow) => string;
  /** Show what each setting means under its value. A review can leave this out to stay short. */
  showNotes?: boolean;
  label?: string;
}

/**
 * Every setting that will apply to the call. Anything that differs from the scenario's own default
 * says so in words ("Changed from default"), never by colour alone.
 */
export function SettingsSummary({ rows, editHref, showNotes = true, label }: SettingsSummaryProps) {
  return (
    <dl className="stp-settings" aria-label={label}>
      {rows.map((row) => (
        <div key={row.key} className="stp-setting" data-changed={row.changed || undefined}>
          <dt className="stp-setting-term">{row.term}</dt>
          <dd className="stp-setting-main">
            <span className="stp-setting-value">
              {row.band ? <TemperatureOrb band={row.band} /> : null}
              <strong>{row.value}</strong>
              {row.changed ? <span className="stp-changed">Changed from default</span> : null}
            </span>
            {showNotes ? <span className="stp-setting-note">{row.description}</span> : null}
            {row.changed ? (
              <span className="stp-setting-was">Scenario default: {row.defaultValue}</span>
            ) : null}
          </dd>
          {editHref ? (
            <dd className="stp-setting-edit">
              <Link
                to={editHref(row)}
                className="btn btn-ghost btn-sm"
                aria-label={`Edit ${row.term.toLowerCase()}`}
              >
                Edit
              </Link>
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
