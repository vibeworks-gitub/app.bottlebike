import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupplierForm } from "../supplier-form";
import { updateSupplier } from "../actions";
import type { Supplier } from "@/lib/types/database";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: supplier } = await supabase
    .from("bb_suppliers")
    .select("*")
    .eq("id", id)
    .maybeSingle<Supplier>();

  if (!supplier) notFound();

  const action = updateSupplier.bind(null, supplier.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/suppliers"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Lieferanten
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">
          {supplier.name}
        </h1>
      </div>
      <SupplierForm
        action={action}
        initial={supplier}
        submitLabel="Speichern"
      />
    </div>
  );
}
