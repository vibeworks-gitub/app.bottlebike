import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocationForm } from "../location-form";
import { updateLocation } from "../actions";
import type { Location } from "@/lib/types/database";

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bb_locations")
    .select("*")
    .eq("id", id)
    .maybeSingle<Location>();

  if (!data) notFound();

  const action = updateLocation.bind(null, data.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Inventar</p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          {data.name}
        </h1>
      </header>
      <LocationForm
        action={action}
        initial={data}
        submitLabel="Speichern"
      />
    </div>
  );
}
