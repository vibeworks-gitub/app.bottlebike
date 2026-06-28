"use client";
import { Button } from "@/components/ui/button";

export function WizardShell({
  title,
  subtitle,
  step,
  totalSteps,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
}: {
  title: string;
  subtitle?: string;
  step: number;
  totalSteps: number;
  children: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <div className="mb-4">
        <p className="text-xs text-muted-foreground">
          Schritt {step} von {totalSteps}
        </p>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex-1 space-y-2 pb-24">{children}</div>
      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
        <div className="mx-auto max-w-md">
          <Button
            className="h-12 w-full text-base"
            onClick={onPrimary}
            disabled={primaryDisabled || primaryLoading}
          >
            {primaryLoading ? "Speichert…" : primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
