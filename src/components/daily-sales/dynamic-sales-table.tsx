"use client";

import { Plus, X, RotateCcw } from "lucide-react";
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
  masterPrices,
  readOnly = false,
}: {
  categories: ServiceCategory[];
  activeKeys: string[];
  values: SalesEntryInput;
  errors: SalesValidationError[];
  touched: boolean;
  onToggleCategory: (key: string) => void;
  onChangeLine: (key: string, field: "qty" | "price", raw: string) => void;
  /** Config-driven Harga Meals master price per category (Rupiah). */
  masterPrices?: Record<string, number>;
  readOnly?: boolean;
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
              disabled={readOnly}
              onClick={() => onToggleCategory(cat.key)}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary disabled:opacity-50"
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
                  disabled={readOnly}
                  onClick={() => onToggleCategory(cat.key)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
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
                          disabled={readOnly}
                          value={line?.qty ?? 0}
                          onChange={(e) => onChangeLine(cat.key, "qty", e.target.value)}
                          className={cn("h-8 w-20 text-right tabular-nums", touched && err && "border-rose-400", readOnly && "opacity-60")}
                        />
                        <span className="w-10 text-left text-[10px] text-muted-foreground">{cat.unit}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        const master = masterPrices?.[cat.key];
                        const differs = master !== undefined && (line?.price ?? 0) !== master;
                        return (
                          <div className="flex flex-col items-end gap-0.5">
                            <Input
                              type="number"
                              min={0}
                              disabled={readOnly}
                              value={line?.price ?? 0}
                              onChange={(e) => onChangeLine(cat.key, "price", e.target.value)}
                              className={cn(
                                "h-8 w-28 text-right",
                                differs && !readOnly && "border-amber-400",
                                readOnly && "opacity-60",
                              )}
                            />
                            {master !== undefined && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                {differs ? (
                                  <>
                                    <span className="text-amber-600">Master {formatCurrency(master)}</span>
                                    {!readOnly && (
                                      <button
                                        type="button"
                                        onClick={() => onChangeLine(cat.key, "price", String(master))}
                                        className="inline-flex items-center gap-0.5 rounded px-1 text-primary hover:bg-accent"
                                        aria-label={`Kembalikan harga master ${cat.label}`}
                                      >
                                        <RotateCcw className="h-2.5 w-2.5" />
                                        Reset
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span>Harga master</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular-nums font-medium", cat.deduction && "text-rose-600")}>
                      {cat.deduction && lineTotal(line) > 0 ? "−" : ""}
                      {formatCurrency(lineTotal(line))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => onToggleCategory(cat.key)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
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
