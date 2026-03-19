import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20 ${className}`}
      {...props}
    />
  );
}
