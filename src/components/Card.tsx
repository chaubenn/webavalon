import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "stone" | "parchment";
};

export function Card({ className = "", variant = "stone", ...props }: CardProps) {
  const surface =
    variant === "parchment"
      ? "border-[var(--border-ornate)] bg-[var(--surface-parchment)]"
      : "border-[rgba(201,168,76,0.2)] bg-[#0d1018]";

  return (
    <div
      className={`rounded-2xl border ${surface} p-5 shadow-xl shadow-black/40 ${className}`}
      {...props}
    />
  );
}
