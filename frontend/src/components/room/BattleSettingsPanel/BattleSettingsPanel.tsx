import { LANGUAGES } from '../../../constants/roomConstants';
import type { RoomSettings } from '../../../types/room';

interface BattleSettingsPanelProps {
  myLanguage: string;
  settings: RoomSettings;
}

export function BattleSettingsPanel({ myLanguage, settings }: BattleSettingsPanelProps) {
  const lang = LANGUAGES.find((l) => l.id === myLanguage);

  return (
    <div className="panel-section">
      <div className="section-title">BATTLE SETTINGS</div>
      <div className="setting-row">
        <span className="setting-label">언어</span>
        <span className="setting-val">
          {lang?.icon} {lang?.label}
        </span>
      </div>
      <div className="setting-row">
        <span className="setting-label">난이도</span>
        <span className="setting-val">{settings.diff}</span>
      </div>
      <div className="setting-row">
        <span className="setting-label">문제 수</span>
        <span className="setting-val">{settings.count} 개</span>
      </div>
    </div>
  );
}
