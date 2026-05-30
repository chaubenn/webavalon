"use client";

import Image from "next/image";
import { MissionBoard } from "@/components/MissionBoard";
import { BoardVotePanel } from "@/components/game/BoardVotePanel";
import { UI_ASSETS } from "@/lib/assets";
import type { GamePublicView, PlayerSlot } from "@/lib/api";
import type { TeamVoteResult } from "@/lib/team-vote";

type QuestTableHeroProps = {
  players: PlayerSlot[];
  game: GamePublicView;
  playerMap: Map<string, string>;
  showCaptainOrder: boolean;
  onToggleCaptainOrder: () => void;
  teamVoteReveal?: TeamVoteResult | null;
  onDismissTeamVote?: () => void;
  children?: React.ReactNode;
};

export function QuestTableHero({
  players,
  game,
  playerMap,
  showCaptainOrder,
  onToggleCaptainOrder,
  teamVoteReveal,
  onDismissTeamVote,
  children
}: QuestTableHeroProps) {
  const phaseLabel = game.phase.replace(/_/g, " ");

  return (
    <section className="overflow-hidden rounded-3xl border-2 border-[var(--gold-dim)] bg-[#0a0e14] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]">
      <header className="relative overflow-hidden border-b-2 border-[var(--gold-dim)]/40 bg-[linear-gradient(180deg,#10141d_0%,#0a0e14_100%)] px-4 py-5 text-center">
        <span className="relative mx-auto mb-2 flex h-12 w-12 items-center justify-center">
          <Image
            src={UI_ASSETS.crest}
            alt=""
            fill
            priority
            sizes="48px"
            className="object-contain"
          />
        </span>
        <div className="flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--gold-dim)] sm:w-12" />
          <p className="font-display text-[0.65rem] uppercase tracking-[0.35em] text-[var(--gold)] sm:text-xs">
            The Round Table
          </p>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--gold-dim)] sm:w-12" />
        </div>
        <h2 className="mt-1 font-display text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
          Quest {game.missionIndex + 1} of 5
        </h2>
      </header>

      {/* Score counters — physical chips on the board edge */}
      <div className="flex flex-wrap gap-2 border-b border-[rgba(201,168,76,0.15)] bg-[#0c1018] px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2 rounded-lg border border-[rgba(42,122,74,0.55)] bg-[#0a1610] px-3 py-1.5">
          <span className="font-display text-lg font-semibold text-[var(--realm-green-bright)]">
            {game.scores.success}
          </span>
          <span className="text-xs text-[var(--parchment-dim)]">
            {game.scores.success === 1 ? "Win" : "Wins"}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[rgba(155,32,32,0.55)] bg-[#140a0a] px-3 py-1.5">
          <span className="font-display text-lg font-semibold text-[var(--crimson-bright)]">
            {game.scores.fail}
          </span>
          <span className="text-xs text-[var(--parchment-dim)]">
            {game.scores.fail === 1 ? "Fail" : "Fails"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-[var(--parchment-dim)]">
          <span className="rounded-md border border-[rgba(201,168,76,0.2)] bg-[#07090d] px-2 py-1 capitalize text-[var(--gold)]">
            {phaseLabel}
          </span>
          <span className="rounded-md border border-[rgba(201,168,76,0.15)] bg-[#07090d] px-2 py-1">
            {game.teamRejections}/5 rejections
          </span>
        </div>
      </div>

      {/* Captain rail */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(201,168,76,0.12)] bg-[#0e1219] px-3 py-2.5 sm:px-4">
        <span className="relative inline-flex h-6 w-6 shrink-0">
          <Image
            src={UI_ASSETS.captainSeal}
            alt=""
            fill
            sizes="24px"
            className="object-contain"
          />
        </span>
        <span className="font-display text-xs uppercase tracking-[0.15em] text-[var(--gold-dim)]">
          Captain
        </span>
        <span className="font-semibold text-[var(--foreground)]">
          {game.captainId ? (playerMap.get(game.captainId) ?? "—") : "—"}
        </span>
        <button
          type="button"
          onClick={onToggleCaptainOrder}
          className={`rounded-md border px-2 py-0.5 text-xs font-display transition ${
            showCaptainOrder
              ? "border-[var(--gold)] bg-[rgba(201,168,76,0.15)] text-[var(--gold)]"
              : "border-[rgba(201,168,76,0.25)] text-[var(--parchment-dim)] hover:text-[var(--gold)]"
          }`}
        >
          Rotation
        </button>
      </div>

      {showCaptainOrder && (
        <div className="border-b border-[rgba(201,168,76,0.1)] bg-[#0c1018] px-3 py-2 animate-fade-in sm:px-4">
          <div className="flex flex-wrap gap-1.5">
            {game.captainOrder.map((playerId, i) => {
              const isCurrent = i === game.captainIndex;
              return (
                <span
                  key={playerId}
                  className={`rounded-md border px-2 py-0.5 text-xs ${
                    isCurrent
                      ? "border-[var(--gold)] bg-[rgba(201,168,76,0.12)] text-[var(--gold)]"
                      : "border-[rgba(201,168,76,0.12)] text-[var(--parchment-dim)]"
                  }`}
                >
                  {i + 1}. {playerMap.get(playerId) ?? "?"}
                  {isCurrent ? " ◀" : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Council vote — on the board */}
      {teamVoteReveal && onDismissTeamVote && (
        <div className="border-b border-[var(--gold-dim)] bg-[#0a0e14] p-3 sm:p-4">
          <p className="mb-2 font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
            Council vote
          </p>
          <BoardVotePanel vote={teamVoteReveal} onDismiss={onDismissTeamVote} />
        </div>
      )}

      {/* Quest slots on felt */}
      <div className="bg-[#12161f] px-2 py-3 sm:px-3 sm:py-4">
        <MissionBoard players={players} game={game} variant="board" />
      </div>

      {/* Player actions dock */}
      {children ? (
        <div className="border-t-2 border-[var(--gold-dim)]/30 bg-[#0c1018] p-3 sm:p-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
