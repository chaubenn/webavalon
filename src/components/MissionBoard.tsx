"use client";

import { useEffect, useRef, useState } from "react";
import { getMissionTeamSize } from "@/lib/game";
import type { GamePublicView, PlayerSlot } from "@/lib/api";

type MissionBoardProps = {
  players: PlayerSlot[];
  game: GamePublicView;
};

type VoteCard = "hidden" | "success" | "fail";

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function MissionBoard({ players, game }: MissionBoardProps) {
  const playerMap = new Map(players.map((p) => [p.id, p.name]));
  const { history } = game;

  const [revealMaps, setRevealMaps] = useState<Map<number, VoteCard[]>>(
    new Map()
  );
  const initializedRef = useRef(false);
  const seenLengthRef = useRef(0);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      seenLengthRef.current = history.length;
      const init = new Map<number, VoteCard[]>();
      for (const m of history) {
        const failCount = m.failCount ?? 0;
        const successCount = m.teamIds.length - failCount;
        init.set(
          m.index,
          shuffle([
            ...Array<VoteCard>(successCount).fill("success"),
            ...Array<VoteCard>(failCount).fill("fail")
          ])
        );
      }
      setRevealMaps(init);
      return;
    }

    if (history.length <= seenLengthRef.current) return;

    const newMission = history[seenLengthRef.current];
    seenLengthRef.current = history.length;
    if (!newMission) return;

    const failCount = newMission.failCount ?? 0;
    const successCount = newMission.teamIds.length - failCount;
    const finalCards = shuffle([
      ...Array<VoteCard>(successCount).fill("success"),
      ...Array<VoteCard>(failCount).fill("fail")
    ]);
    const mIdx = newMission.index;
    const teamSize = newMission.teamIds.length;

    setRevealMaps((prev) => {
      const next = new Map(prev);
      next.set(mIdx, Array<VoteCard>(teamSize).fill("hidden"));
      return next;
    });

    for (let i = 0; i < teamSize; i++) {
      const cardI = i;
      setTimeout(() => {
        setRevealMaps((prev) => {
          const next = new Map(prev);
          const cards = [...(next.get(mIdx) ?? [])];
          cards[cardI] = finalCards[cardI];
          next.set(mIdx, cards);
          return next;
        });
      }, (cardI + 1) * 620);
    }
  }, [history.length]);

  const historyByIndex = new Map(history.map((m) => [m.index, m]));
  const winningMissionIndex =
    game.winner && history.length
      ? history[history.length - 1].index
      : null;

  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
        ✦ The Quest Board ✦
      </h3>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }, (_, missionIndex) => {
          const record = historyByIndex.get(missionIndex);
          const ladyUse = game.ladyUses.find(
            (entry) => entry.missionIndex === missionIndex
          );
          const isCurrent = missionIndex === game.missionIndex;
          const teamIds =
            record?.teamIds ?? (isCurrent ? game.currentTeamIds : []);
          const teamNames = teamIds.map((id) => playerMap.get(id) ?? "Unknown");
          const teamSize = getMissionTeamSize(players.length, missionIndex);
          const isComplete = record !== undefined;
          const isWin = winningMissionIndex === missionIndex;
          const cards = revealMaps.get(missionIndex);
          const allRevealed =
            isComplete && cards !== undefined && !cards.includes("hidden");

          const failCount = record?.failCount ?? 0;
          const successCount = isComplete
            ? (record?.teamIds.length ?? 0) - failCount
            : 0;

          let resultLabel = "Pending";
          if (isComplete) {
            resultLabel = record?.success ? "Victory" : "Betrayal";
          } else if (isCurrent) {
            if (teamIds.length === 0) resultLabel = "Awaiting fellowship";
            else if (game.phase === "mission_vote") resultLabel = "Quest underway";
            else resultLabel = "Assembled";
          }

          const cardTone = isComplete
            ? record?.success
              ? "border-[rgba(42,122,74,0.6)] bg-[var(--realm-green)]"
              : "border-[rgba(155,32,32,0.6)] bg-[var(--crimson)]"
            : isCurrent
              ? "border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.05)]"
              : "border-[rgba(201,168,76,0.12)] bg-[#0a0d12]";

          return (
            <div
              key={missionIndex}
              className={`relative rounded-2xl border p-4 transition-all ${cardTone}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold tracking-wide text-[var(--foreground)]">
                  Quest {missionIndex + 1}
                  {isWin && (
                    <span className="ml-2 inline-block text-[var(--gold)]">
                      ♔
                    </span>
                  )}
                </span>
                <span className="text-xs text-[var(--parchment-dim)]">
                  {teamSize} knights
                </span>
              </div>

              {/* Result label */}
              <div
                className={`mt-1 text-xs font-display tracking-wide ${
                  isComplete
                    ? record?.success
                      ? "text-[var(--realm-green-bright)]"
                      : "text-[var(--crimson-bright)]"
                    : isCurrent
                      ? "text-[var(--gold)]"
                      : "text-[var(--parchment-dim)]"
                }`}
              >
                {resultLabel}
              </div>

              {/* Vote cards — animated reveal */}
              {isComplete && cards !== undefined && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {cards.map((card, i) => {
                      const isHidden = card === "hidden";
                      return (
                        <div
                          key={i}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-base transition-all ${
                            isHidden
                              ? "border-[rgba(201,168,76,0.2)] bg-[#07090d] animate-pulse-soft"
                              : card === "success"
                                ? "border-[rgba(42,122,74,0.7)] bg-[rgba(42,122,74,0.3)] animate-card-flip-in text-[var(--realm-green-bright)]"
                                : "border-[rgba(155,32,32,0.7)] bg-[rgba(155,32,32,0.3)] animate-card-flip-in text-[var(--crimson-bright)]"
                          }`}
                          style={
                            !isHidden
                              ? {
                                  animationDelay: `${i * 0.05}s`,
                                  animationFillMode: "both"
                                }
                              : undefined
                          }
                        >
                          {isHidden ? (
                            <span className="text-[var(--gold-dim)]">✦</span>
                          ) : card === "success" ? (
                            "✦"
                          ) : (
                            "⚔"
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Vote counts — show after all revealed */}
                  {allRevealed && (
                    <div className="flex items-center gap-3 text-xs animate-fade-in">
                      <span className="text-[var(--realm-green-bright)]">
                        {successCount} loyal
                      </span>
                      {failCount > 0 && (
                        <>
                          <span className="text-[var(--parchment-dim)]">·</span>
                          <span className="text-[var(--crimson-bright)]">
                            {failCount} traitor{failCount > 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Lady of the Lake annotation */}
              {ladyUse && (
                <div className="mt-3 rounded-xl border border-[rgba(74,144,196,0.3)] bg-[rgba(14,26,46,0.8)] px-3 py-2 text-xs text-[var(--lady-blue-bright)]">
                  ◈ Lady used by{" "}
                  <span className="font-semibold">
                    {playerMap.get(ladyUse.viewerId) ?? "Unknown"}
                  </span>{" "}
                  on{" "}
                  <span className="font-semibold">
                    {playerMap.get(ladyUse.targetId) ?? "Unknown"}
                  </span>
                </div>
              )}

              {/* Team chips */}
              {teamNames.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {teamNames.map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="rounded-full border border-[rgba(201,168,76,0.2)] px-2.5 py-0.5 text-xs text-[var(--parchment-dim)]"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
