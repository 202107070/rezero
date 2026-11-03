import { CharacterAvatar } from '../../common/CharacterAvatar';
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
          <button
            key={c.id}
            type="button"
            className={`avatar-btn ${myCharacter === c.id ? 'selected' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <CharacterAvatar character={c.id} className="avatar-btn-img" />
            <div className="avatar-btn-label">{c.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
