import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageTitle } from "@/components/admin/ui";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const { supabase } = await requireAdminPage();
  const { data: categories } = await supabase.from("categories").select("*").order("sort_order");
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/products" className="underline">← Products</Link></p>
      <PageTitle>Add product</PageTitle>
      <p className="mb-6 text-sm text-muted">You can add photos after creating the product.</p>
      <ProductForm product={null} categories={(categories ?? []) as Category[]} />
    </>
  );
}
