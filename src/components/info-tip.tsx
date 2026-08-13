// Kleiner ⓘ-Hover-Tooltip ohne JS — funktioniert per CSS (group-hover),
// zuverlässiger und schneller als native title-Attribute.
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-block cursor-help align-middle">
      <span
        aria-label={text}
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] font-bold leading-none opacity-60"
      >
        i
      </span>
      <span className="pointer-events-none invisible absolute right-0 top-full z-50 mt-1.5 w-60 rounded-md border border-border bg-card p-2 text-left text-[11px] font-normal normal-case tracking-normal text-foreground opacity-0 shadow-lg transition-opacity duration-100 group-hover:visible group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}
