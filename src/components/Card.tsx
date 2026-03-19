import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-[rgba(201,168,76,0.2)] bg-[#0d1018] p-5 shadow-xl shadow-black/40 ${className}`}
      {...props}
    />
  );
}
