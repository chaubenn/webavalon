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
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400"
      : variant === "outline"
        ? "border border-white/15 text-white hover:bg-white/10"
        : "text-white/80 hover:text-white";

  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
