export type Role = "admin" | "user";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  notes: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  cost_price: number;
  selling_price: number;
  vat_rate: number;
  margin_percent: number | null;
  category_id: string | null;
  supplier_id: string | null;
  image_url: string | null;
  stock: number;
  weight_kg: number | null;
  width_cm: number | null;
  height_cm: number | null;
  depth_cm: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductCost = {
  id: string;
  product_id: string;
  label: string;
  amount: number;
  sort_order: number;
  created_at: string;
};

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

export type Quote = {
  id: string;
  number: string | null;
  title: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_address: string | null;
  status: QuoteStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  sort_order: number;
};
