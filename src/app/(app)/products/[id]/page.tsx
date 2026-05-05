import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";
import { updateProduct } from "../actions";
import type { Product } from "@/lib/types/database";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle<Product>();

  if (!product) notFound();

  const action = updateProduct.bind(null, product.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/products" className="text-sm text-muted-foreground hover:underline">
          ← zurück
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>
        <p className="text-sm text-muted-foreground">
          SKU: <span className="font-mono">{product.sku}</span>
        </p>
      </div>
      <ProductForm
        action={action}
        initial={product}
        submitLabel="Änderungen speichern"
      />
    </div>
  );
}
