import { CHARACTERS } from '../../../constants/roomConstants';

interface CharacterSelectProps {
  myCharacter: string;
  onSelect: (id: string) => void;
}

export function CharacterSelect({ myCharacter, onSelect }: CharacterSelectProps) {
  return (
    <div className="panel-section">
      <div className="section-title">CHARACTER SELECT</div>
      <div className="avatar-select-grid">
        {CHARACTERS.map((c) => (
          <div
            key={c.id}
            className={`avatar-btn ${myCharacter === c.id ? 'selected' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            {c.icon}
            <div style={{ fontSize: '18px', marginTop: '4px' }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
