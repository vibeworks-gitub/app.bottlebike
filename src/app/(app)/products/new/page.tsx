import Link from "next/link";
import { ProductForm } from "../product-form";
import { createProduct } from "../actions";

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/products" className="text-sm text-muted-foreground hover:underline">
          ← zurück
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Neues Produkt</h1>
      </div>
      <ProductForm action={createProduct} submitLabel="Produkt anlegen" />
    </div>
  );
}
