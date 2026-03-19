import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-display tracking-wide transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed";

  const styles =
    variant === "primary"
      ? "bg-[var(--gold)] text-[#07090d] font-semibold shadow-lg shadow-[var(--gold-dim)]/30 hover:bg-[var(--gold-light)] hover:shadow-[var(--gold)]/40"
      : variant === "outline"
        ? "border border-[rgba(201,168,76,0.45)] text-[var(--gold)] hover:bg-[rgba(201,168,76,0.1)] hover:border-[var(--gold)]"
        : "text-[var(--parchment-dim)] hover:text-[var(--gold)]";

  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
