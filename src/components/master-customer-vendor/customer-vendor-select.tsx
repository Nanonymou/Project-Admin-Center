"use client";

import { useMemo } from "react";
import { listCustomerVendors, type PartyType } from "@/lib/mock/customer-vendor";
import { cn } from "@/lib/utils";

/**
 * Reusable customer/vendor picker. Lists only *active* parties from the master
 * directory, optionally restricted to one type (customer or vendor), for forms
 * that reference a party — e.g. an invoice picking its customer, or a purchase
 * picking a vendor. Presentational and controlled; one selector fed by the
 * Master Customer & Vendor data keeps every form consistent.
 */
export function CustomerVendorSelect({
  value,
  onChange,
  type = "all",
  label,
  id = "party-select",
  placeholder = "Pilih…",
  disabled = false,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Restrict options to a party type, or "all". */
  type?: PartyType | "all";
  label?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const options = useMemo(
    () =>
      listCustomerVendors().filter(
        (p) => p.status === "active" && (type === "all" || p.type === type),
      ),
    [type],
  );
  const empty = options.length === 0;

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        disabled={disabled || empty}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      >
        {empty ? (
          <option value="">Tidak ada data aktif</option>
        ) : (
          <>
            <option value="">{placeholder}</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
