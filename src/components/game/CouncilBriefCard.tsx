"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/Button";
import { RoleCard } from "@/components/roles/RoleCard";
import { UI_ASSETS } from "@/lib/assets";
import type { RoleId } from "@/lib/roles";

type KnowledgeEntry = { slotId: string; name: string; tag: string };

type CouncilBriefCardProps = {
  roleSummary: string[];
  ladyEnabled: boolean;
  role?: { id: RoleId; name: string; alignment: "good" | "evil" };
  knowledge?: KnowledgeEntry[];
  gameStarted: boolean;
};

export function CouncilBriefCard({
  roleSummary,
  ladyEnabled,
  role,
  knowledge,
  gameStarted
}: CouncilBriefCardProps) {
  const [revealing, setRevealing] = useState(false);

  return (
    <article className="overflow-hidden rounded-2xl border-2 border-[var(--gold-dim)]/40 bg-[#0c1018]">
      <header className="flex items-center justify-between gap-3 border-b border-[rgba(201,168,76,0.2)] bg-[#0e1219] px-4 py-2.5">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
          Your council
        </p>
        <span className="relative h-7 w-7 shrink-0">
          <Image
            src={UI_ASSETS.waxSeal}
            alt=""
            fill
            sizes="28px"
            className="object-contain"
          />
        </span>
      </header>

      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {roleSummary.map((label) => (
            <span
              key={label}
              className="rounded-md border border-[rgba(201,168,76,0.25)] bg-[#07090d] px-2 py-0.5 text-xs text-[var(--parchment-dim)]"
            >
              {label}
            </span>
          ))}
          <span
            className={`rounded-md border px-2 py-0.5 text-xs ${
              ladyEnabled
                ? "border-[rgba(74,144,196,0.5)] bg-[rgba(14,26,46,0.6)] text-[var(--lady-blue-bright)]"
                : "border-[rgba(201,168,76,0.15)] bg-[#07090d] text-[var(--parchment-dim)]/60"
            }`}
          >
            {ladyEnabled ? "◈ Lady of the Lake" : "Lady of the Lake · absent"}
          </span>
        </div>

        {gameStarted && role && (
          <div className="border-t border-[rgba(201,168,76,0.12)] pt-3">
            {!revealing ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--parchment-dim)]">
                  Sealed on this device only.
                </p>
                <Button
                  className="shrink-0 px-4 py-2 text-xs"
                  onClick={() => setRevealing(true)}
                >
                  Reveal role
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
                  Your role
                </p>
                <RoleCard roleId={role.id} reveal className="max-w-[220px]" />
                {knowledge?.length ? (
                  <ul className="space-y-1">
                    {knowledge.map((entry, i) => (
                      <li
                        key={`${entry.slotId}-${i}`}
                        className="flex justify-between rounded-md border border-[rgba(201,168,76,0.12)] bg-[#07090d] px-3 py-1.5 text-sm"
                      >
                        <span>{entry.name}</span>
                        <span className="text-xs text-[var(--parchment-dim)]">
                          {entry.tag}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic text-[var(--parchment-dim)]">
                    No secrets revealed to you.
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full px-4 py-2 text-xs sm:w-auto"
                  onClick={() => setRevealing(false)}
                >
                  Conceal
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
