import { Icon, type IconName } from '../Icon.tsx';

export type Tone = 'blue' | 'violet' | 'amber' | 'green' | 'red';

/** A dashboard number with an icon: "8  Scenarios completed". */
export function StatCard({
  icon,
  tone = 'blue',
  value,
  label,
  note,
}: {
  icon: IconName;
  tone?: Tone;
  value: string | number;
  label: string;
  note?: string;
}) {
  return (
    <div className="stat glass">
      <span className="stat-icon" data-tone={tone}>
        <Icon name={icon} size={22} />
      </span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {note ? <div className="stat-note">{note}</div> : null}
      </div>
    </div>
  );
}
