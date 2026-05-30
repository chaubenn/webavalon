"use client";

import { useState } from "react";
import Image from "next/image";
import { ROLE_DEFINITIONS, ROLE_PRESENTATION, type RoleId } from "@/lib/roles";

type RoleIconProps = {
  roleId: RoleId;
  size?: number;
  className?: string;
};

export function RoleIcon({ roleId, size = 40, className = "" }: RoleIconProps) {
  const definition = ROLE_DEFINITIONS[roleId];
  const { iconSrc, cardSrc, accent } = ROLE_PRESENTATION[roleId];
  const isGood = accent === "good";
  const [src, setSrc] = useState(iconSrc ?? cardSrc);
  const [failed, setFailed] = useState(false);

  return (
    <span
      title={definition.name}
      style={{ width: size, height: size }}
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full border ${
        isGood
          ? "border-[rgba(42,122,74,0.6)]"
          : "border-[rgba(155,32,32,0.6)]"
      } ${className}`}
    >
      {!failed ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover object-top"
          onError={() => {
            if (src !== cardSrc) setSrc(cardSrc);
            else setFailed(true);
          }}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[var(--surface-stone-raised)] text-xs text-[var(--gold-dim)]">
          ✦
        </span>
      )}
    </span>
  );
}
