import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { Avatar, Icon } from '../../design/index.ts';
import './persona.css';

export interface PersonaProps {
  persona: PublicScenarioDTO['persona'];
  size?: 'md' | 'lg';
}

/** The fictional customer: initials, name, role and organisation. Never a photograph. */
export function Persona({ persona, size = 'lg' }: PersonaProps) {
  return (
    <div className="scn-persona">
      <Avatar name={persona.name} size={size} />
      <div className="scn-persona__text">
        <p className="scn-persona__name">{persona.name}</p>
        <p className="scn-persona__role">
          {persona.role}, {persona.organisation}
        </p>
        <p className="scn-persona__note">
          <Icon name="person" size={14} />
          Fictional customer
        </p>
      </div>
    </div>
  );
}
