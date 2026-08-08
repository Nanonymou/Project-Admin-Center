"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** One parsed & validated row from an import file. */
export type ParsedRow = {
  cells: string[];
  valid: boolean;
  issues: string[];
  /** Set when the row duplicates an earlier row's unique key. */
  duplicate?: boolean;
};

/**
 * Validate raw parsed rows (excluding the header) against a set of per-column
 * validators. Reusable across import screens: a validator returns an error
 * string for its cell, or null when the value is acceptable.
 */
export function validateRows(
  dataRows: string[][],
  validators: ((value: string, row: string[]) => string | null)[],
): ParsedRow[] {
  return dataRows.map((cells) => {
    const issues: string[] = [];
    validators.forEach((fn, i) => {
      const issue = fn((cells[i] ?? "").trim(), cells);
      if (issue) issues.push(issue);
    });
    return { cells, valid: issues.length === 0, issues };
  });
}

/** True when the file header matches the expected columns (order-sensitive). */
export function isHeaderValid(header: string[] | null, columns: readonly string[]): boolean {
  return (
    header !== null &&
    header.length >= columns.length &&
    columns.every((c, i) => (header[i] ?? "").trim().toLowerCase() === c.toLowerCase())
  );
}

/**
 * Reusable import preview + validation panel. Renders per-row validation status
 * against the expected columns, a header-match indicator, valid/invalid counts,
 * and an import action. Presentational and stateless — the parent owns parsing
 * and the confirm handler.
 */
export function ImportPreview({
  columns,
  header,
  rows,
  fileName,
  onReset,
  onConfirm,
  confirmLabel,
}: {
  columns: readonly string[];
  header: string[];
  rows: ParsedRow[];
  fileName?: string | null;
  onReset?: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
}) {
  const headerOk = isHeaderValid(header, columns);
  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:space-y-0">
        <div>
          <CardTitle>Pratinjau &amp; Validasi</CardTitle>
          <CardDescription>
            {rows.length} baris terbaca{fileName ? ` dari ${fileName}` : ""}.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={headerOk ? "success" : "danger"}>Header {headerOk ? "cocok" : "tidak cocok"}</Badge>
          <Badge variant="success">{validCount} valid</Badge>
          {invalidCount > 0 && <Badge variant="danger">{invalidCount} invalid</Badge>}
          {onReset && (
            <Button size="sm" variant="ghost" onClick={onReset}>
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!headerOk && (
          <div className="mx-4 mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            Kolom yang diharapkan: <b>{columns.join(", ")}</b>. Perbaiki header file lalu unggah ulang.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">#</th>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-2 text-left font-medium">
                    {c}
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className="px-3 py-6 text-center text-muted-foreground">
                    Tidak ada baris data.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className={cn("border-b last:border-0", !r.valid && "bg-rose-50")}>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  {columns.map((_, ci) => (
                    <td key={ci} className="px-3 py-2 tabular-nums">
                      {r.cells[ci] ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {r.valid ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Valid
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-rose-700"
                        title={r.issues.join(" ")}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {r.issues[0]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {onConfirm && (
          <div className="flex items-center justify-end gap-2 border-t p-3">
            <Button size="sm" disabled={!headerOk || validCount === 0} onClick={onConfirm}>
              {confirmLabel ?? `Impor ${validCount} baris`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
