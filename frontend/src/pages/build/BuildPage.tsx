import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { DEFAULT_TEMPLATE } from '../../utils/battle/codeUtils';
import { runBuildSimulation, type BuildLogLine } from '../../utils/build/buildSimulator';
import { BuildCodeEditor } from '../../components/build/BuildCodeEditor';
import './build.css';

const BUILD_LANGS = ['JAVA', 'PYTHON', 'CPP', 'HTML', 'CSS'] as const;

type BuildStatus = 'idle' | 'building' | 'success' | 'error';

const STATUS_LABEL: Record<BuildStatus, string> = {
  idle: '대기',
  building: '빌드 중...',
  success: '성공',
  error: '실패',
};

export default function BuildPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<(typeof BUILD_LANGS)[number]>('JAVA');
  const [code, setCode] = useState(DEFAULT_TEMPLATE.JAVA);
  const [logs, setLogs] = useState<BuildLogLine[]>([]);
  const [status, setStatus] = useState<BuildStatus>('idle');
  const consoleRef = useRef<HTMLDivElement>(null);
  const buildTokenRef = useRef(0);

  const scrollConsoleToBottom = useCallback(() => {
    const el = consoleRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const runBuild = useCallback(async () => {
    const token = ++buildTokenRef.current;
    setStatus('building');
    setLogs([]);

    const signal = { cancelled: () => buildTokenRef.current !== token };

    const result = await runBuildSimulation(code, lang, (line) => {
      if (signal.cancelled()) return;
      setLogs((prev) => [...prev, line]);
    }, signal);

    if (signal.cancelled()) return;
    setStatus(result);
  }, [code, lang]);

  useEffect(() => {
    scrollConsoleToBottom();
  }, [logs, scrollConsoleToBottom]);

  const handleLangChange = (next: string) => {
    const key = next as (typeof BUILD_LANGS)[number];
    setLang(key);
    setCode(DEFAULT_TEMPLATE[key] || '');
    setLogs([]);
    setStatus('idle');
  };

  const handleClearAll = () => {
    buildTokenRef.current += 1;
    setCode(DEFAULT_TEMPLATE[lang] || '');
    setLogs([]);
    setStatus('idle');
  };

  return (
    <div className="page-container build-page">
      <header className="build-header">
        <span className="build-header-title">BUILD SYSTEM</span>
        <div className="build-header-actions">
          <span className={`build-status-pill ${status}`}>{STATUS_LABEL[status]}</span>
          <select
            className="build-lang-select"
            value={lang}
            onChange={(e) => handleLangChange(e.target.value)}
          >
            {BUILD_LANGS.map((item) => (
              <option key={item} value={item}>
                {item === 'CPP' ? 'C++' : item}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="pixel-btn pixel-btn-success"
            onClick={() => void runBuild()}
            disabled={status === 'building'}
          >
            빌드
          </button>
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={() => navigate(ROUTES.LOBBY)}>
            로비
          </button>
        </div>
      </header>

      <p className="build-hint">코드를 작성한 뒤 빌드 버튼을 눌러 결과를 확인하세요.</p>

      <div className="build-body">
        <section className="build-editor-panel">
          <div className="build-panel-header">
            <span>코드 작성</span>
            <span style={{ color: '#b2bec3', fontSize: '14px' }}>{lang === 'CPP' ? 'C++' : lang}</span>
          </div>
          <BuildCodeEditor code={code} lang={lang} onChange={setCode} />
        </section>

        <div className="build-console-column">
          <div className="build-console-toolbar">
            <button
              type="button"
              className="pixel-btn pixel-btn-secondary build-clear-btn"
              onClick={handleClearAll}
              disabled={status === 'building'}
            >
              초기화
            </button>
          </div>
          <section className="build-console-panel">
            <div className="build-panel-header">
              <span>빌드 결과</span>
            </div>
            <div className="build-console-output" ref={consoleRef}>
              {logs.length === 0 ? (
                <p className="build-console-empty">빌드 로그가 여기에 표시됩니다.</p>
              ) : (
                logs.map((line, index) => (
                  <p key={`${index}-${line.text}`} className={`build-log-line ${line.level}`}>
                    {line.text}
                  </p>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
