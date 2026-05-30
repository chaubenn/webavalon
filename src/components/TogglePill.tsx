import Image from "next/image";

type TogglePillProps = {
  active: boolean;
  label: string;
  onClick: () => void;
  iconSrc?: string;
};

export function TogglePill({ active, label, onClick, iconSrc }: TogglePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full py-1.5 text-xs font-display tracking-wide transition-all ${
        iconSrc ? "pl-1.5 pr-3.5" : "px-4"
      } ${
        active
          ? "bg-[var(--gold)] text-[#07090d] shadow-md shadow-[var(--gold-dim)]/40"
          : "border border-[rgba(201,168,76,0.3)] text-[var(--parchment-dim)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
      }`}
    >
      {iconSrc ? (
        <span
          className={`relative inline-flex h-5 w-5 overflow-hidden rounded-full ring-1 ${
            active ? "ring-[#07090d]/30" : "ring-[rgba(201,168,76,0.3)]"
          }`}
        >
          <Image
            src={iconSrc}
            alt=""
            fill
            sizes="20px"
            className="object-cover object-top"
          />
        </span>
      ) : null}
      {label}
    </button>
  );
}
