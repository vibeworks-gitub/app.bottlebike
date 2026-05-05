import Link from "next/link";
import { SupplierForm } from "../supplier-form";
import { createSupplier } from "../actions";

export default function NewSupplierPage() {
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
          Neuer Lieferant
        </h1>
      </div>
      <SupplierForm action={createSupplier} submitLabel="Lieferant anlegen" />
    </div>
  );
}
