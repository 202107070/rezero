import type { ReactNode } from 'react';
import ProblemVisualPreview from './ProblemVisualPreview';
import type { BattleProblem } from '../../types/battle';
import {
  getBotSpectatorAnswers,
  getBotSpectatorMcIndex,
  resolveSpectatorViewProblemIndex,
  type DemoBot,
} from '../../utils/battle/demoBots';
import { resolveProblemCapabilities } from '../../utils/problemCapabilities';
import FillBlankRenderer from './FillBlankRenderer';
import { getTierIconByUserName } from '../../utils/tierUtils';

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
  currentIndex: number;
  problems: BattleProblem[];
  currentProblem: BattleProblem;
  isItemMode: boolean;
  langKey: string;
  spectatorViewProblemByBot: Record<string, number>;
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

function getViewProblemIndex(
  bot: BotView,
  demoSpectating: boolean,
  spectatorViewProblemByBot: Record<string, number>,
): number {
  if (!demoSpectating) return bot.currentProblem;
  return resolveSpectatorViewProblemIndex(bot.id, bot.currentProblem, spectatorViewProblemByBot);
}

function OpponentProblemBody({
  problem,
  bot,
  viewProblemIndex,
  isItemMode,
  langKey,
  compact,
  showAnswers,
}: {
  problem: BattleProblem;
  bot: BotView;
  viewProblemIndex: number;
  isItemMode: boolean;
  langKey: string;
  compact?: boolean;
  showAnswers: boolean;
}) {
  const caps = resolveProblemCapabilities(problem, { gameMode: isItemMode ? 'item' : 'normal' });
  const shouldRenderVisual = caps.hasVisual || caps.hasImage;
  const displayAnswers = showAnswers
    ? getBotSpectatorAnswers(bot, viewProblemIndex, problem, langKey)
    : [];
  const mcIndex = showAnswers ? getBotSpectatorMcIndex(bot, problem, viewProblemIndex) : null;
  const promptText = problem.question || '';
  const blankMarkerCount = (problem.question || '').match(/_____/g)?.length || 0;
  const answerMaskClass = showAnswers ? '' : ' opponent-answers-masked';

  return (
    <>
      {!compact && (
        <div className="spectator-problem-head">
          <div className="code-problem-kicker">PROBLEM</div>
          <div className="code-problem-title">{problem.title || `Problem ${viewProblemIndex + 1}`}</div>
        </div>
      )}
      {caps.showCodePanel && (
        <div className="fill-blank-area spectator-opponent-fill">
          {shouldRenderVisual && <ProblemVisualPreview visual={problem.visual} compact={compact} />}
          {blankMarkerCount > 0 ? (
            <div className={`fill-blank-code${answerMaskClass}`}>
              <FillBlankRenderer
                code={problem.question || ''}
                answers={displayAnswers}
                problemIndex={viewProblemIndex}
                breakingBlanks={{}}
                isLocked
                isBotView={!showAnswers}
              />
            </div>
          ) : (
            <>
              {promptText && <div className="code-problem-question">{promptText}</div>}
              {(showAnswers ? displayAnswers.length > 0 : true) && (
                <div className={answerMaskClass || undefined}>
                  <input
                    className="blank-input battle-short-input"
                    value={showAnswers ? displayAnswers.join(', ') : ''}
                    placeholder={showAnswers ? undefined : '???'}
                    readOnly
                    disabled
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
      {caps.showMultipleChoicePanel && (
        <div className="fill-blank-area fill-blank-area-answers spectator-opponent-fill">
          {promptText && <div className="code-problem-question">{promptText}</div>}
          {shouldRenderVisual && (
            <ProblemVisualPreview visual={problem.visual} compact={compact} suppressCaption={Boolean(promptText)} />
          )}
          <div className={answerMaskClass || undefined}>
            {(problem.options || []).map((opt, i) => {
              const isSelected = mcIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  className={`pixel-btn battle-choice-btn is-locked${isSelected ? ' is-selected' : ''}`}
                  disabled
                  style={{ opacity: mcIndex !== null && !isSelected ? 0.55 : 1 }}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {caps.showShortAnswerPanel && (
        <div className="fill-blank-area fill-blank-area-answers spectator-opponent-fill">
          {promptText && <div className="code-problem-question">{promptText}</div>}
          {shouldRenderVisual && (
            <ProblemVisualPreview visual={problem.visual} compact={compact} suppressCaption={Boolean(promptText)} />
          )}
          <div className={answerMaskClass || undefined}>
            <input
              className="blank-input battle-short-input"
              value={showAnswers ? displayAnswers[0] || '' : ''}
              placeholder={showAnswers ? undefined : '???'}
              readOnly
              disabled
            />
          </div>
        </div>
      )}
    </>
  );
}

export default function OpponentPanels({
  battleBots,
  expandedOpponentId,
  setExpandedOpponentId,
  demoIsVersusMany,
  demoSpectating,
  currentIndex,
  problems,
  currentProblem,
  isItemMode,
  langKey,
  spectatorViewProblemByBot,
  opponentEffects,
  panelHit,
  onOpenItemModal,
  showItemButton = true,
  renderMiniStatus,
}: OpponentPanelsProps) {
  const now = Date.now();

  const renderMini = (bot: BotView) => {
    const viewProblemIndex = getViewProblemIndex(bot, demoSpectating, spectatorViewProblemByBot);
    const panelEff = opponentEffects[bot.id]?.[viewProblemIndex]?.panelEffect;
    const hasPaint = panelEff?.type === 'paint' && now < panelEff.expiresAt;
    const hasLightning = panelEff?.type === 'lightning' && now < panelEff.expiresAt;
    const hasScribble = panelEff?.type === 'scribble' && now < panelEff.expiresAt;
    const effIcon = effectIcons(panelEff, now);
    const botProb = problems[viewProblemIndex] || currentProblem;

    return (
      <div
        key={bot.id}
        className={`opponent-code-panel-mini ${demoSpectating ? 'revealed' : 'problem-preview'}`}
        onClick={() => setExpandedOpponentId(bot.id)}
      >
        <div className="mini-header">
          <span>
            {bot.avatar} <span className="mini-tier">{getTierIconByUserName(bot.name)}</span> {bot.name}
            <span className="mini-view-problem-label"> · Q{viewProblemIndex + 1}</span>
          </span>
          <span>
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
          <div className="mini-code-textarea spectator-opponent-mini-body" style={{ whiteSpace: 'pre-wrap', overflow: 'auto' }}>
            <OpponentProblemBody
              problem={botProb}
              bot={bot}
              viewProblemIndex={viewProblemIndex}
              isItemMode={isItemMode}
              langKey={langKey}
              compact
              showAnswers={demoSpectating}
            />
          </div>
        </div>
      </div>
    );
  };

  if (expandedOpponentId) {
    const bot = battleBots.find((b) => b.id === expandedOpponentId);
    if (!bot) return null;

    const viewProblemIndex = getViewProblemIndex(bot, demoSpectating, spectatorViewProblemByBot);
    const panelEff = opponentEffects[bot.id]?.[viewProblemIndex]?.panelEffect;
    const hasActivePaint = panelEff?.type === 'paint' && now < panelEff.expiresAt;
    const hasLightning = panelEff?.type === 'lightning' && now < panelEff.expiresAt;
    const hasScribble = panelEff?.type === 'scribble' && now < panelEff.expiresAt;
    const isRevealed = demoSpectating;
    const botProb = problems[viewProblemIndex] || currentProblem;

    return (
      <div
        data-opponent-id={bot.id}
        className={`opponent-code-panel-mini expanded ${isRevealed ? 'revealed' : 'problem-preview'}${panelHit[bot.id] ? ' panel-hit' : ''}`}
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
            {bot.avatar} <span className="mini-tier">{getTierIconByUserName(bot.name)}</span> {bot.name}
            <span className="mini-view-problem-label"> · Q{viewProblemIndex + 1}</span>
          </span>
          <span>
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
          <div className="mini-code-lines spectator-opponent-expanded-body">
            <OpponentProblemBody
              problem={botProb}
              bot={bot}
              viewProblemIndex={viewProblemIndex}
              isItemMode={isItemMode}
              langKey={langKey}
              showAnswers={demoSpectating}
            />
          </div>
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
