import { useEffect, useRef } from 'react';
import { BuildCodeEditor } from '../build/BuildCodeEditor';
import type { BuildLogLine } from '../../utils/build/buildSimulator';

interface BattleBuildPanelProps {
  code: string;
  lang: string;
  langLabel: string;
  buildsUsed: number;
  buildsAllowed: number;
  isBuilding: boolean;
  logs: BuildLogLine[];
  collapsed: boolean;
  disabled?: boolean;
  onCodeChange: (code: string) => void;
  onBuild: () => void;
  onToggleCollapse: () => void;
}

function logClass(level: BuildLogLine['level']) {
  if (level === 'error') return 'terminal-error';
  if (level === 'success') return 'terminal-success';
  if (level === 'info') return 'terminal-running';
  return '';
}

export default function BattleBuildPanel({
  code,
  lang,
  langLabel,
  buildsUsed,
  buildsAllowed,
  isBuilding,
  logs,
  collapsed,
  disabled,
  onCodeChange,
  onBuild,
  onToggleCollapse,
}: BattleBuildPanelProps) {
  const consoleRef = useRef<HTMLDivElement>(null);
  const buildsRemaining = Math.max(0, buildsAllowed - buildsUsed);
  const canBuild = !disabled && !isBuilding && buildsRemaining > 0;

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, isBuilding]);

  return (
    <div className={`battle-build-panel${collapsed ? ' is-collapsed' : ''}`}>
      <div className="battle-build-header">
        <div className="battle-build-title">
          <span className="battle-build-kicker">BUILD</span>
          <span className="code-card-lang-badge">{langLabel}</span>
        </div>
        <div className="battle-build-meta">
          <span className={buildsRemaining <= 0 ? 'pixel-text-danger' : 'pixel-text-warning'}>
            빌드 {buildsRemaining}/{buildsAllowed}
          </span>
          <button
            type="button"
            className="pixel-btn pixel-btn-primary battle-build-btn"
            onClick={onBuild}
            disabled={!canBuild}
          >
            {isBuilding ? '빌드 중...' : '빌드'}
          </button>
          <button type="button" className="panel-toggle-btn" onClick={onToggleCollapse}>
            {collapsed ? '▲' : '▼'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="battle-build-body">
          <div className="battle-build-editor">
            <BuildCodeEditor code={code} lang={lang} onChange={onCodeChange} />
          </div>
          <div className="battle-build-console">
            <div className="terminal-header">
              <span>BUILD OUTPUT</span>
              {isBuilding && <span className="terminal-running">running...</span>}
            </div>
            <div className="terminal-content" ref={consoleRef}>
              {logs.length === 0 ? (
                <span style={{ color: '#636e72' }}>빌드 버튼을 눌러 결과를 확인하세요.</span>
              ) : (
                logs.map((line, i) => (
                  <div key={`${i}-${line.text}`} className={logClass(line.level)}>
                    {line.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
