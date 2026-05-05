"use client";

import { Badge } from "@/components/ui/badge";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

export type CustomerRow = Record<string, unknown> & {
  customer_id: number;
  customer_name: string | null;
  customer_company_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_city: string | null;
  customer_active: boolean | null;
};

export function CustomersView({ rows }: { rows: CustomerRow[] }) {
  const columns: SimpleColumn<CustomerRow>[] = [
    { key: "customer_id", label: "ID", width: "100px" },
    { key: "customer_name", label: "Name" },
    { key: "customer_company_name", label: "Firma" },
    { key: "customer_email", label: "E-Mail" },
    { key: "customer_phone", label: "Telefon" },
    { key: "customer_city", label: "Stadt" },
    {
      key: "customer_active",
      label: "Status",
      render: (r) =>
        r.customer_active ? (
          <Badge variant="secondary">aktiv</Badge>
        ) : (
          <Badge variant="outline">inaktiv</Badge>
        ),
    },
  ];

  return (
    <SimpleTable
      rows={rows}
      columns={columns}
      searchKeys={[
        "customer_id",
        "customer_name",
        "customer_company_name",
        "customer_email",
        "customer_phone",
        "customer_city",
      ]}
    />
  );
}
