type PhaseBannerProps = {
  message: string;
  tone?: "gold" | "crimson" | "lady";
};

export function PhaseBanner({ message, tone = "gold" }: PhaseBannerProps) {
  const toneClass =
    tone === "crimson"
      ? "border-[rgba(155,32,32,0.5)] bg-[rgba(107,18,18,0.45)] text-[var(--crimson-bright)]"
      : tone === "lady"
        ? "border-[rgba(74,144,196,0.5)] bg-[rgba(14,26,46,0.7)] text-[var(--lady-blue-bright)]"
        : "border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.14)] text-[var(--gold)]";

  return (
    <div
      className={`sticky top-2 z-20 flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-display tracking-wide backdrop-blur seal-shadow animate-fade-in ${toneClass}`}
    >
      <span className="animate-pulse-soft">✦</span>
      <span>{message}</span>
    </div>
  );
}
