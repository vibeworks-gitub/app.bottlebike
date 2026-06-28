"use client";
import { Input } from "@/components/ui/input";

export function ProductCountInput({
  name,
  expected,
  value,
  onChange,
  showDiff = true,
}: {
  name: string;
  expected: number | null;
  value: string;
  onChange: (v: string) => void;
  showDiff?: boolean;
}) {
  const parsed = value === "" ? null : Number(value);
  const diff =
    showDiff && expected != null && parsed != null && !Number.isNaN(parsed)
      ? parsed - expected
      : null;

  return (
    <div className="flex items-center justify-between gap-3 border-b py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium">{name}</p>
        {expected != null && (
          <p className="text-xs text-muted-foreground">SOLL {expected}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          className="h-12 w-20 text-center text-lg"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          aria-label={`IST ${name}`}
        />
        {diff != null && diff !== 0 && (
          <span
            className="w-10 text-right text-sm font-medium"
            style={{ color: diff < 0 ? "var(--destructive)" : "var(--brand)" }}
          >
            {diff > 0 ? "+" : ""}
            {diff}
          </span>
        )}
      </div>
    </div>
  );
}
