"use client";

import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  lineTotal,
  signedLineTotal,
  type SalesEntryInput,
  type SalesLineInput,
  type SalesValidationError,
  type ServiceCategory,
} from "@/lib/mock/service-config";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * Dynamic sales input: a category picker chip row to add/remove line items,
 * plus an editable Qty × Harga table for the selected categories. Fully
 * controlled by the parent (values + active category keys).
 */
export function DynamicSalesTable({
  categories,
  activeKeys,
  values,
  errors,
  touched,
  onToggleCategory,
  onChangeLine,
}: {
  categories: ServiceCategory[];
  activeKeys: string[];
  values: SalesEntryInput;
  errors: SalesValidationError[];
  touched: boolean;
  onToggleCategory: (key: string) => void;
  onChangeLine: (key: string, field: "qty" | "price", raw: string) => void;
}) {
  const activeSet = new Set(activeKeys);
  const activeCategories = categories.filter((c) => activeSet.has(c.key));
  const inactiveCategories = categories.filter((c) => !activeSet.has(c.key));

  const totalQty = activeCategories.reduce((sum, c) => sum + Math.max(0, values[c.key]?.qty || 0), 0);
  const totalAmount = activeCategories.reduce((sum, c) => sum + signedLineTotal(c, values[c.key]), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/20 p-2.5">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Kategori Aktif
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activeCategories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => onToggleCategory(cat.key)}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {cat.label}
              <X className="h-3 w-3" />
            </button>
          ))}
          {activeCategories.length === 0 && (
            <span className="text-xs italic text-muted-foreground">
              Belum ada kategori dipilih — tambahkan dari daftar di bawah.
            </span>
          )}
        </div>
        {inactiveCategories.length > 0 && (
          <>
            <div className="mb-1.5 mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tambah Kategori
            </div>
            <div className="flex flex-wrap gap-1.5">
              {inactiveCategories.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => onToggleCategory(cat.key)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
                >
                  <Plus className="h-3 w-3" />
                  {cat.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {activeCategories.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Kategori</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Harga</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                <th className="w-8 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {activeCategories.map((cat) => {
                const line: SalesLineInput | undefined = values[cat.key];
                const err = errors.find((e) => e.key === cat.key);
                return (
                  <tr key={cat.key} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        {cat.label}
                        {cat.deduction && (
                          <span className="rounded bg-rose-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-rose-700">
                            Potongan
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">per {cat.unit}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={line?.qty ?? 0}
                          onChange={(e) => onChangeLine(cat.key, "qty", e.target.value)}
                          className={cn("h-8 w-20 text-right tabular-nums", touched && err && "border-rose-400")}
                        />
                        <span className="w-10 text-left text-[10px] text-muted-foreground">{cat.unit}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        value={line?.price ?? 0}
                        onChange={(e) => onChangeLine(cat.key, "price", e.target.value)}
                        className="h-8 w-28 text-right"
                      />
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular-nums font-medium", cat.deduction && "text-rose-600")}>
                      {cat.deduction && lineTotal(line) > 0 ? "−" : ""}
                      {formatCurrency(lineTotal(line))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onToggleCategory(cat.key)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent"
                        aria-label={`Hapus ${cat.label}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 text-xs font-medium">
                <td className="px-3 py-2">Total Harian (net)</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalQty}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totalAmount)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
