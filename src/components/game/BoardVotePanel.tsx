"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import type { TeamVoteResult } from "@/lib/team-vote";

type BoardVotePanelProps = {
  vote: TeamVoteResult;
  onDismiss: () => void;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Inline council vote tally on the quest board — not a fullscreen overlay. */
export function BoardVotePanel({ vote, onDismiss }: BoardVotePanelProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [revealedApproves, setRevealedApproves] = useState(0);
  const [revealedRejects, setRevealedRejects] = useState(0);
  const [showVerdict, setShowVerdict] = useState(false);

  useEffect(() => {
    setRevealedApproves(0);
    setRevealedRejects(0);
    setShowVerdict(false);

    if (reducedMotion) {
      setRevealedApproves(vote.approve);
      setRevealedRejects(vote.reject);
      setShowVerdict(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const tickMs = 400;

    let a = 0;
    const tickA = () => {
      a += 1;
      setRevealedApproves(a);
      if (a < vote.approve) timers.push(setTimeout(tickA, tickMs));
      else timers.push(setTimeout(startRejects, tickMs));
    };
    if (vote.approve === 0) timers.push(setTimeout(startRejects, tickMs));
    else tickA();

    function startRejects() {
      let r = 0;
      const tickR = () => {
        r += 1;
        setRevealedRejects(r);
        if (r < vote.reject) timers.push(setTimeout(tickR, tickMs));
        else timers.push(setTimeout(() => setShowVerdict(true), tickMs));
      };
      if (vote.reject === 0) timers.push(setTimeout(() => setShowVerdict(true), tickMs));
      else tickR();
    }

    return () => timers.forEach(clearTimeout);
  }, [vote.approve, vote.reject, vote.approved, reducedMotion]);

  useEffect(() => {
    if (!showVerdict || reducedMotion) return;
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [showVerdict, reducedMotion, onDismiss]);

  return (
    <div
      className="animate-fade-in-scale overflow-hidden rounded-2xl border-2 border-[var(--gold-dim)] bg-[#0c1018] shadow-[inset_0_0_0_1px_rgba(201,168,76,0.15)]"
      role="status"
      aria-live="polite"
    >
      <div className="grid grid-cols-2 gap-px bg-[var(--gold-dim)]/30">
        <div className="bg-[#0a1210] px-4 py-3 text-center">
          <p className="font-display text-[0.6rem] uppercase tracking-[0.22em] text-[var(--realm-green-bright)]">
            Approve
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-[var(--realm-green-bright)]">
            {revealedApproves}
          </p>
          <div className="mt-1 flex justify-center gap-0.5">
            {Array.from({ length: vote.approve }).map((_, i) => (
              <span
                key={`a-${i}`}
                className={`text-xs transition-opacity duration-200 ${
                  i < revealedApproves ? "opacity-100" : "opacity-0"
                }`}
              >
                ✦
              </span>
            ))}
          </div>
        </div>
        <div className="bg-[#140a0a] px-4 py-3 text-center">
          <p className="font-display text-[0.6rem] uppercase tracking-[0.22em] text-[var(--crimson-bright)]">
            Reject
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-[var(--crimson-bright)]">
            {revealedRejects}
          </p>
          <div className="mt-1 flex justify-center gap-0.5">
            {Array.from({ length: vote.reject }).map((_, i) => (
              <span
                key={`r-${i}`}
                className={`text-xs transition-opacity duration-200 ${
                  i < revealedRejects ? "opacity-100" : "opacity-0"
                }`}
              >
                ⚔
              </span>
            ))}
          </div>
        </div>
      </div>

      {showVerdict && (
        <div
          className={`border-t px-4 py-3 text-center animate-fade-in ${
            vote.approved
              ? "border-[rgba(42,122,74,0.5)] bg-[#0a1610]"
              : "border-[rgba(155,32,32,0.5)] bg-[#160a0a]"
          }`}
        >
          <p
            className={`font-display text-sm font-semibold ${
              vote.approved
                ? "text-[var(--realm-green-bright)]"
                : "text-[var(--crimson-bright)]"
            }`}
          >
            {vote.approved
              ? "Fellowship approved — the quest proceeds"
              : "Fellowship denied — the Captain must choose again"}
          </p>
          <Button
            variant="ghost"
            className="mt-2 w-full text-xs"
            onClick={onDismiss}
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
