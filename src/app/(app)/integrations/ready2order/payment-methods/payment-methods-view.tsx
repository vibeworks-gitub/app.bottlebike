"use client";

import { Badge } from "@/components/ui/badge";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

export type PaymentMethodRow = Record<string, unknown> & {
  payment_id: number;
  payment_name: string | null;
  payment_description: string | null;
  payment_mark_as_paid: boolean | null;
  payment_accounting_code: string | null;
  payment_purpose: string | null;
  payment_type_id: number | null;
};

export function PaymentMethodsView({ rows }: { rows: PaymentMethodRow[] }) {
  const columns: SimpleColumn<PaymentMethodRow>[] = [
    { key: "payment_id", label: "ID", width: "100px" },
    { key: "payment_name", label: "Name" },
    { key: "payment_description", label: "Beschreibung" },
    { key: "payment_purpose", label: "Zweck" },
    { key: "payment_accounting_code", label: "Buchhaltungs-Code" },
    {
      key: "payment_mark_as_paid",
      label: "Bezahlt-Marker",
      render: (r) =>
        r.payment_mark_as_paid ? (
          <Badge variant="secondary">ja</Badge>
        ) : (
          <Badge variant="outline">nein</Badge>
        ),
    },
  ];

  return (
    <SimpleTable
      rows={rows}
      columns={columns}
      searchKeys={[
        "payment_id",
        "payment_name",
        "payment_description",
        "payment_purpose",
      ]}
    />
  );
}
