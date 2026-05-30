"use client";

import { useState } from "react";
import Image from "next/image";
import { ROLE_DEFINITIONS, ROLE_PRESENTATION, type RoleId } from "@/lib/roles";

type RoleCardProps = {
  roleId: RoleId;
  reveal?: boolean;
  className?: string;
};

export function RoleCard({
  roleId,
  reveal = false,
  className = ""
}: RoleCardProps) {
  const definition = ROLE_DEFINITIONS[roleId];
  const { cardSrc, accent, flavorText } = ROLE_PRESENTATION[roleId];
  const isGood = accent === "good";
  const [artFailed, setArtFailed] = useState(false);

  return (
    <figure className={`mx-auto w-full max-w-[300px] space-y-3 ${className}`}>
      <div
        className={`relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 ${
          isGood
            ? "border-[rgba(42,122,74,0.55)] shadow-[0_0_32px_-10px_rgba(39,174,96,0.55)]"
            : "border-[rgba(155,32,32,0.55)] shadow-[0_0_32px_-10px_rgba(192,57,43,0.55)]"
        } ${reveal ? "animate-card-flip-in" : ""}`}
      >
        {cardSrc && !artFailed ? (
          <Image
            src={cardSrc}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 90vw, 300px"
            className="object-cover"
            onError={() => setArtFailed(true)}
          />
        ) : (
          <div
            className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b ${
              isGood
                ? "from-[#0d1a12] via-[#0d1018] to-[#0a140d]"
                : "from-[#1a0d0d] via-[#0d1018] to-[#140a0a]"
            }`}
          >
            <span className="text-5xl text-[var(--gold-dim)]">✦</span>
            <span className="font-display text-[0.65rem] uppercase tracking-[0.3em] text-[var(--gold-dim)]">
              Avalon
            </span>
          </div>
        )}
      </div>

      <figcaption className="space-y-1.5 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <span
            className={`rounded-full px-3 py-1 text-xs font-display tracking-wide ${
              isGood
                ? "border border-[rgba(42,122,74,0.5)] bg-[rgba(26,74,46,0.5)] text-[var(--realm-green-bright)]"
                : "border border-[rgba(155,32,32,0.5)] bg-[rgba(107,18,18,0.5)] text-[var(--crimson-bright)]"
            }`}
          >
            {isGood ? "Loyal" : "Evil"}
          </span>
          <span className="font-display text-xl font-semibold text-[var(--foreground)]">
            {definition.name}
          </span>
        </div>
        <p className="text-sm italic text-[var(--parchment-dim)]">
          {flavorText}
        </p>
      </figcaption>
    </figure>
  );
}
