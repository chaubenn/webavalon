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
      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
        active
          ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
          : "border border-white/10 text-white/70 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
