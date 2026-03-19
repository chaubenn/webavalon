import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-xl border border-[rgba(201,168,76,0.2)] bg-[#07090d] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--parchment-dim)]/50 focus:border-[var(--gold-dim)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-dim)]/40 transition ${className}`}
      {...props}
    />
  );
}
