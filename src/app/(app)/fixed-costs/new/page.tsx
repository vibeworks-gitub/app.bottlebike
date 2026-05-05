import Link from "next/link";
import { FixedCostForm } from "../fixed-cost-form";
import { createFixedCost } from "../actions";

export default function NewFixedCostPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/fixed-costs"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Fixkosten
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">
          Neue Fixkosten
        </h1>
      </div>
      <FixedCostForm action={createFixedCost} submitLabel="Anlegen" />
    </div>
  );
}
