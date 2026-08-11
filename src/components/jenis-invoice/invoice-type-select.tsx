"use client";

import { type InvoiceTypeProfile } from "@/lib/mock/invoice-type-config";
import { cn } from "@/lib/utils";

/**
 * Reusable dropdown of *active* invoice types. Presentational and fully
 * controlled: the parent passes the active type list, the selected key, and an
 * onChange. Used by invoice-creation flows to pick a type profile; keeping it
 * standalone means every form that creates an invoice shares one selector fed by
 * the Jenis Invoice master.
 */
export function InvoiceTypeSelect({
  types,
  value,
  onChange,
  id = "invoice-type",
  label = "Jenis Invoice",
  disabled = false,
  className,
}: {
  /** Active invoice type profiles to offer. */
  types: InvoiceTypeProfile[];
  value: string;
  onChange: (key: string) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const empty = types.length === 0;
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
          <option value="">Tidak ada jenis aktif</option>
        ) : (
          types.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
