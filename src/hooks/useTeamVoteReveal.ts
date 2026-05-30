"use client";

import { useEffect, useRef, useState } from "react";
import type { TeamVoteResult } from "@/lib/team-vote";

type GameWithTeamVote = {
  missionIndex: number;
  lastTeamVote?: TeamVoteResult;
};

export function useTeamVoteReveal(game: GameWithTeamVote | undefined) {
  const [reveal, setReveal] = useState<TeamVoteResult | null>(null);
  const seenKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const vote = game?.lastTeamVote;
    if (!vote || game === undefined) return;

    const key = `${game.missionIndex}:${vote.approve}:${vote.reject}:${vote.approved}`;
    if (seenKeyRef.current === key) return;
    seenKeyRef.current = key;
    setReveal(vote);
  }, [game?.lastTeamVote, game?.missionIndex, game]);

  return {
    teamVoteReveal: reveal,
    dismissTeamVoteReveal: () => setReveal(null),
    missionIndex: game?.missionIndex ?? 0
  };
}
