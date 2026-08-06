"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { computeProfit, computeMarginPct, computeTax } from "@/lib/finance";
import { getTaxConfig } from "@/lib/mock/tax-config";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * Interactive margin calculator — profit, margin %, tax and net invoice are
 * recomputed on every keystroke via the shared finance helpers. The tax rate
 * comes from the project's config, so the same widget serves any project.
 */
export function MarginCalculator({ projectCode }: { projectCode: string }) {
  const [sales, setSales] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);

  const profit = computeProfit(sales, cost);
  const marginPct = computeMarginPct(sales, cost);
  const tax = computeTax(sales, projectCode);
  const taxLabel = getTaxConfig(projectCode).label;
  const netInvoice = sales + tax;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Kalkulator Margin
        </CardTitle>
        <CardDescription>
          Hitung profit, margin & net invoice otomatis — pajak mengikuti konfigurasi {projectCode}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Sales</label>
            <Input
              type="number"
              min={0}
              value={sales || ""}
              placeholder="0"
              onChange={(e) => setSales(Number(e.target.value) || 0)}
              className="tabular-nums"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cost</label>
            <Input
              type="number"
              min={0}
              value={cost || ""}
              placeholder="0"
              onChange={(e) => setCost(Number(e.target.value) || 0)}
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ResultTile label="Profit" value={formatCurrency(profit)} tone={profit >= 0 ? "text-emerald-700" : "text-rose-700"} />
          <ResultTile label="Margin %" value={`${marginPct.toFixed(1)}%`} />
          <ResultTile label={taxLabel} value={formatCurrency(tax)} />
          <ResultTile label="Net Invoice" value={formatCurrency(netInvoice)} highlight />
        </div>
      </CardContent>
    </Card>
  );
}

function ResultTile({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  tone?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-md border p-2.5", highlight ? "border-primary/30 bg-primary/5" : "bg-background")}>
      <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", tone)}>{value}</div>
    </div>
  );
}
