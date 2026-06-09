import type { ReactNode } from 'react';
import type { BattleProblem } from '../../types/battle';
import type { DemoBot } from '../../utils/battle/demoBots';
import FillBlankRenderer from './FillBlankRenderer';

export interface BotView extends DemoBot {
  status: string;
  solvedProblems: number[];
  currentProblem: number;
  currentProblemSolved: boolean;
  currentBlankAnswers: string[];
  currentSchedule: number;
}

interface PanelEffect {
  type: string;
  expiresAt: number;
}

interface OpponentPanelsProps {
  battleBots: BotView[];
  expandedOpponentId: string | null;
  setExpandedOpponentId: (id: string | null) => void;
  demoIsVersusMany: boolean;
  demoSpectating: boolean;
  currentProblemLocked: boolean;
  currentIndex: number;
  problems: BattleProblem[];
  currentProblem: BattleProblem;
  userRankMap: Record<string, number>;
  opponentEffects: Record<string, Record<number, { panelEffect?: PanelEffect }>>;
  panelHit: Record<string, boolean>;
  onOpenItemModal: (botId: string) => void;
  showItemButton?: boolean;
  renderMiniStatus: (bot: BotView) => ReactNode;
}

function effectIcons(
  panelEff: PanelEffect | undefined,
  now: number,
): string {
  let icons = '';
  if (panelEff?.type === 'paint' && now < panelEff.expiresAt) icons += '🎨';
  if (panelEff?.type === 'lightning' && now < panelEff.expiresAt) icons += '⚡';
  if (panelEff?.type === 'scribble' && now < panelEff.expiresAt) icons += '✏️';
  return icons;
}

export default function OpponentPanels({
  battleBots,
  expandedOpponentId,
  setExpandedOpponentId,
  demoIsVersusMany,
  demoSpectating,
  currentProblemLocked,
  currentIndex,
  problems,
  currentProblem,
  userRankMap,
  opponentEffects,
  panelHit,
  onOpenItemModal,
  showItemButton = true,
  renderMiniStatus,
}: OpponentPanelsProps) {
  const now = Date.now();

  const renderMini = (bot: BotView) => {
    const panelEff = opponentEffects[bot.id]?.[currentIndex]?.panelEffect;
    const hasPaint = panelEff?.type === 'paint' && now < panelEff.expiresAt;
    const hasLightning = panelEff?.type === 'lightning' && now < panelEff.expiresAt;
    const hasScribble = panelEff?.type === 'scribble' && now < panelEff.expiresAt;
    const revealed = demoSpectating || currentProblemLocked || hasPaint || hasLightning || hasScribble;
    const effIcon = effectIcons(panelEff, now);

    return (
      <div
        key={bot.id}
        className={`opponent-code-panel-mini ${revealed ? 'revealed' : 'hidden'}`}
        onClick={() => setExpandedOpponentId(bot.id)}
        style={{ cursor: 'pointer' }}
      >
        <div className="mini-header">
          <span>
            {bot.avatar}{' '}
            <span style={{ color: 'var(--px-warning)', fontSize: '15px' }}>#{userRankMap[bot.id] || '?'}</span>{' '}
            {bot.name}
            {bot.solvedProblems?.length > 0 && (
              <span style={{ color: '#ff6b35', fontSize: '13px', marginLeft: '4px', textShadow: '1px 1px 0 #000' }}>
                🔥{bot.solvedProblems.length}
              </span>
            )}
          </span>
          <span>
            {bot.status === 'solved' ? '✓' : '...'}
            {effIcon}
            {showItemButton && (
              <button
                type="button"
                className="item-btn item-btn-mini"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenItemModal(bot.id);
                }}
                title="아이템 사용"
              >
                ⚡
              </button>
            )}
          </span>
        </div>
        {renderMiniStatus(bot)}
        <div
          className={`mini-code-area${hasPaint ? ' paint-marked' : ''}${hasLightning ? ' lightning-struck' : ''}${hasScribble ? ' scribble-marked' : ''}`}
        >
          <div className="mini-code-textarea" style={{ whiteSpace: 'pre-wrap', overflow: 'auto' }}>
            <FillBlankRenderer
              code={(problems[bot.currentProblem] || currentProblem).question || ''}
              answers={[]}
              problemIndex={-1}
              correctBlanks={{}}
              breakingBlanks={{}}
              isLocked
              isBotView
            />
          </div>
          <div className="mini-overlay">
            {bot.avatar} CODE
            <small>클릭하여 확대</small>
          </div>
        </div>
      </div>
    );
  };

  if (expandedOpponentId) {
    const bot = battleBots.find((b) => b.id === expandedOpponentId);
    if (!bot) return null;

    const panelEff = opponentEffects[bot.id]?.[currentIndex]?.panelEffect;
    const hasActivePaint = panelEff?.type === 'paint' && now < panelEff.expiresAt;
    const hasLightning = panelEff?.type === 'lightning' && now < panelEff.expiresAt;
    const hasScribble = panelEff?.type === 'scribble' && now < panelEff.expiresAt;
    const isRevealed = demoSpectating || currentProblemLocked || hasActivePaint || hasLightning || hasScribble;
    const botProb = problems[bot.currentProblem] || currentProblem;
    const partialCode = botProb.question || '';
    const codeLines = partialCode.split('\n');
    const edAnswers = isRevealed ? bot.currentBlankAnswers : [];

    let gIdx = 0;

    return (
      <div
        className={`opponent-code-panel-mini expanded ${isRevealed ? 'revealed' : 'hidden'}${panelHit[bot.id] ? ' panel-hit' : ''}`}
      >
        <div className="mini-header">
          <span>
            {demoIsVersusMany && (
              <button
                type="button"
                className="mini-back-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedOpponentId(null);
                }}
              >
                ◀ BACK
              </button>
            )}
            {bot.avatar}{' '}
            <span style={{ color: 'var(--px-warning)', fontSize: '16px' }}>#{userRankMap[bot.id] || '?'}</span>{' '}
            {bot.name}
            {bot.solvedProblems?.length > 0 && (
              <span style={{ color: '#ff6b35', fontSize: '15px', marginLeft: '6px', textShadow: '1px 1px 0 #000' }}>
                🔥 {bot.solvedProblems.length}
              </span>
            )}
          </span>
          <span>
            {bot.status === 'solved' ? '✓' : '...'}
            {effectIcons(panelEff, now)}
            {showItemButton && (
              <button
                type="button"
                className="item-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenItemModal(bot.id);
                }}
                title="아이템 사용"
              >
                ⚡ ITEM
              </button>
            )}
          </span>
        </div>
        {renderMiniStatus(bot)}
        <div
          className={`mini-code-area${hasActivePaint ? ' paint-marked' : ''}${hasLightning ? ' lightning-struck' : ''}${hasScribble ? ' scribble-marked' : ''}`}
          style={{ position: 'relative' }}
        >
          <div
            className="mini-code-lines"
            style={{
              width: '100%',
              height: '100%',
              overflow: 'auto',
              background: '#1a1e21',
              padding: '4px 6px',
              fontFamily: 'var(--font-pixel)',
              fontSize: '14px',
              lineHeight: '1.5',
              color: 'var(--px-text)',
              position: 'relative',
            }}
          >
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {codeLines.map((line, lineIdx) => {
                const parts = line.split('_____');
                const lineResult = (
                  <div key={lineIdx} style={{ padding: '1px 4px', minHeight: '1.5em', whiteSpace: 'pre-wrap' }}>
                    {parts.map((part, partIdx) => {
                      const blankIdx = gIdx + partIdx;
                      return (
                        <span key={partIdx} style={{ whiteSpace: 'pre-wrap' }}>
                          {part}
                          {partIdx < parts.length - 1 && (
                            <input
                              className="blank-input"
                              value={edAnswers[blankIdx] || ''}
                              readOnly
                              disabled
                              style={{ width: '80px', display: 'inline-block', pointerEvents: 'none' }}
                            />
                          )}
                        </span>
                      );
                    })}
                  </div>
                );
                gIdx += parts.length - 1;
                return lineResult;
              })}
            </div>
          </div>
          {!isRevealed && (
            <div className="mini-overlay">
              {bot.avatar} CODE
              <small>제출 후 확인 가능</small>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (battleBots.length >= 5) {
    const mid = Math.ceil(battleBots.length / 2);
    const leftBots = battleBots.slice(0, mid);
    const rightBots = battleBots.slice(mid);
    return (
      <>
        <div className="opponent-col">{leftBots.map(renderMini)}</div>
        <div className="opponent-col">{rightBots.map(renderMini)}</div>
      </>
    );
  }

  return <>{battleBots.map(renderMini)}</>;
}
