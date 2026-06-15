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
  deposit_product_id: number | null;
  shelf_life_days: number | null;
  stock_behavior: "sale" | "retour_for" | "no_stock_effect";
  retour_for_product_id: number | null;
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
  commission_pct: number | null;
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
  accounting_start_date: string | null;
  created_at: string;
  updated_at: string;
};

export type LocationType = "warehouse" | "bike";

export type Location = {
  id: string;
  owner_id: string;
  name: string;
  type: LocationType;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CashRegister = {
  id: string;
  owner_id: string;
  name: string;
  r2o_cash_register_id: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CashRegisterStatus = {
  id: string;
  owner_id: string;
  name: string;
  r2o_cash_register_id: string | null;
  active: boolean;
  current_assignment_id: string | null;
  current_location_id: string | null;
  current_assignment_since: string | null;
  current_location_name: string | null;
  current_location_type: LocationType | null;
  is_unassigned: boolean;
};

export type RegisterAssignment = {
  id: string;
  owner_id: string;
  cash_register_id: string;
  location_id: string;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type PurchaseStatus = "draft" | "booked";

export type Purchase = {
  id: string;
  owner_id: string;
  supplier_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  destination_location_id: string;
  total_net: number | null;
  total_gross: number | null;
  notes: string | null;
  status: PurchaseStatus;
  received_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseItem = {
  id: string;
  owner_id: string;
  purchase_id: string;
  r2o_product_id: number;
  quantity: number;
  unit_cost_net: number | null;
  expiry_date: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

export type StockMovementType =
  | "purchase"
  | "transfer"
  | "sale"
  | "adjustment"
  | "reversal";

export type StockMovement = {
  id: string;
  owner_id: string;
  r2o_product_id: number;
  from_location_id: string | null;
  to_location_id: string | null;
  quantity: number;
  type: StockMovementType;
  ref_table: string | null;
  ref_id: string | null;
  occurred_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type StockByLocation = {
  owner_id: string;
  r2o_product_id: number;
  location_id: string;
  quantity: number;
};

export type StockThreshold = {
  owner_id: string;
  r2o_product_id: number;
  location_id: string;
  min_quantity: number;
  updated_at: string;
};

export type ShiftStatus = "open" | "closed";

export type Shift = {
  id: string;
  owner_id: string;
  location_id: string;
  r2o_user_id: number | null;
  cash_register_id: string | null;
  started_at: string;
  ended_at: string | null;
  start_cash_eur: number | null;
  end_cash_eur: number | null;
  start_notes: string | null;
  end_notes: string | null;
  status: ShiftStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ShiftCountType = "start" | "end" | "mid";

export type ShiftCount = {
  id: string;
  owner_id: string;
  shift_id: string;
  r2o_product_id: number;
  count_type: ShiftCountType;
  counted_qty: number;
  counted_at: string;
  counted_by: string | null;
  notes: string | null;
};

export type UnbookedSaleReason =
  | "no_register_id_in_raw"
  | "cash_register_unknown"
  | "no_assignment_at_timestamp";

export type UnbookedSale = {
  owner_id: string;
  invoice_id: number;
  invoice_number_full: string | null;
  invoice_timestamp: string | null;
  r2o_cash_register_id: string | null;
  cash_register_id: string | null;
  cash_register_name: string | null;
  reason: UnbookedSaleReason;
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
