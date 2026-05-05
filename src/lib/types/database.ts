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

export type Supplier = {
  id: string;
  owner_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductExtra = {
  owner_id: string;
  r2o_product_id: number;
  cost_price: number | null;
  cost_includes_vat: boolean;
  supplier_id: string | null;
  reorder_level: number | null;
  target_margin_pct: number | null;
  package_unit: string | null;
  package_qty: number | null;
  custom_name: string | null;
  custom_category: string | null;
  notes: string | null;
  last_purchase_date: string | null;
  last_purchase_price: number | null;
  created_at: string;
  updated_at: string;
};

export type FixedCostFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type FixedCost = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  category: string | null;
  amount: number;
  frequency: FixedCostFrequency;
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffCost = {
  id: string;
  owner_id: string;
  r2o_user_id: number | null;
  display_name: string;
  role: string | null;
  monthly_salary: number | null;
  hourly_rate: number | null;
  hours_per_week: number | null;
  employer_cost_factor: number | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationProvider = "ready2order";

export type Integration = {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  account_token: string;
  metadata: Record<string, unknown>;
  auto_sync_minutes: number | null;
  last_synced_at: string | null;
  last_full_sync_at: string | null;
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
