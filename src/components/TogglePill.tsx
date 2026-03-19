type TogglePillProps = {
  active: boolean;
  label: string;
  onClick: () => void;
};

export function TogglePill({ active, label, onClick }: TogglePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-display tracking-wide transition-all ${
        active
          ? "bg-[var(--gold)] text-[#07090d] shadow-md shadow-[var(--gold-dim)]/40"
          : "border border-[rgba(201,168,76,0.3)] text-[var(--parchment-dim)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
      }`}
    >
      {label}
    </button>
  );
}
