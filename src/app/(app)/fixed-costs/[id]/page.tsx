import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FixedCostForm } from "../fixed-cost-form";
import { updateFixedCost } from "../actions";
import type { FixedCost } from "@/lib/types/database";

export default async function EditFixedCostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cost } = await supabase
    .from("bb_fixed_costs")
    .select("*")
    .eq("id", id)
    .maybeSingle<FixedCost>();
  if (!cost) notFound();

  const action = updateFixedCost.bind(null, cost.id);

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
          {cost.name}
        </h1>
      </div>
      <FixedCostForm
        action={action}
        initial={cost}
        submitLabel="Speichern"
      />
    </div>
  );
}
