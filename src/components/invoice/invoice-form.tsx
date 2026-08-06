"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeTax } from "@/lib/finance";
import { getTaxConfig } from "@/lib/mock/tax-config";
import { cn, formatCurrency } from "@/lib/utils";

export type InvoiceFormLine = {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
};

export type InvoiceFormValue = {
  id?: string;
  invoiceNumber?: string;
  projectCode: string;
  locationId: string;
  locationName: string;
  pic: string;
  dueDate: string;
  lines: InvoiceFormLine[];
};

export type InvoiceComputed = {
  subtotal: number;
  tax: number;
  taxLabel: string;
  net: number;
};

type SiteOption = { locationId: string; locationName: string; projectCode: string };

type Props = {
  open: boolean;
  mode: "add" | "edit";
  sites: SiteOption[];
  initial?: InvoiceFormValue;
  onClose: () => void;
  onSubmit: (value: InvoiceFormValue, computed: InvoiceComputed) => void;
};

let lineSeq = 0;
function newLine(): InvoiceFormLine {
  lineSeq += 1;
  return { id: `line-${Date.now()}-${lineSeq}`, description: "", qty: 1, unitPrice: 0 };
}

function emptyValue(sites: SiteOption[]): InvoiceFormValue {
  const first = sites[0];
  return {
    projectCode: first?.projectCode ?? "",
    locationId: first?.locationId ?? "",
    locationName: first?.locationName ?? "",
    pic: "",
    dueDate: "",
    lines: [newLine()],
  };
}

/**
 * Add/edit invoice form. Subtotal, tax and net are recomputed on every
 * keystroke; the tax rate is read from the project's tax config (never
 * hard-coded), so any project bills with its own rule.
 */
export function InvoiceForm({ open, mode, sites, initial, onClose, onSubmit }: Props) {
  const [value, setValue] = useState<InvoiceFormValue>(() => initial ?? emptyValue(sites));
  const [touched, setTouched] = useState(false);

  // Re-seed the form whenever it (re)opens for a different record.
  useEffect(() => {
    if (open) {
      setValue(initial ?? emptyValue(sites));
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const computed = useMemo<InvoiceComputed>(() => {
    const subtotal = value.lines.reduce(
      (s, l) => s + Math.max(0, l.qty) * Math.max(0, l.unitPrice),
      0,
    );
    const tax = computeTax(subtotal, value.projectCode);
    return { subtotal, tax, taxLabel: getTaxConfig(value.projectCode).label, net: subtotal + tax };
  }, [value.lines, value.projectCode]);

  function setLine(id: string, field: keyof InvoiceFormLine, raw: string) {
    setValue((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.id === id
          ? { ...l, [field]: field === "description" ? raw : raw === "" ? 0 : Number(raw) }
          : l,
      ),
    }));
  }

  function addLine() {
    setValue((prev) => ({ ...prev, lines: [...prev.lines, newLine()] }));
  }

  function removeLine(id: string) {
    setValue((prev) => ({
      ...prev,
      lines: prev.lines.length > 1 ? prev.lines.filter((l) => l.id !== id) : prev.lines,
    }));
  }

  function selectSite(locationId: string) {
    const site = sites.find((s) => s.locationId === locationId);
    if (!site) return;
    setValue((prev) => ({
      ...prev,
      locationId: site.locationId,
      locationName: site.locationName,
      projectCode: site.projectCode,
    }));
  }

  const validLines = value.lines.filter((l) => l.description.trim() && l.qty > 0);
  const canSubmit =
    Boolean(value.locationId) && value.pic.trim().length > 0 && validLines.length > 0;

  function submit() {
    setTouched(true);
    if (!canSubmit) return;
    onSubmit({ ...value, lines: validLines }, computed);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "add" ? "Tambah Invoice" : "Edit Invoice"}
      description={
        value.invoiceNumber
          ? value.invoiceNumber
          : "Nilai pajak & net dihitung otomatis dari konfigurasi project."
      }
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Net Invoice: </span>
            <span className="font-semibold tabular-nums">{formatCurrency(computed.net)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button size="sm" onClick={submit} disabled={!canSubmit}>
              <Save className="h-4 w-4" />
              Simpan
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Site</label>
            <select
              value={value.locationId}
              onChange={(e) => selectSite(e.target.value)}
              disabled={mode === "edit"}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              {sites.map((s) => (
                <option key={s.locationId} value={s.locationId}>
                  {s.projectCode} · {s.locationName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              PIC <span className="text-rose-600">*</span>
            </label>
            <Input
              value={value.pic}
              onChange={(e) => setValue((prev) => ({ ...prev, pic: e.target.value }))}
              placeholder="Nama PIC"
              className={cn(touched && !value.pic.trim() && "border-rose-400")}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Jatuh Tempo</label>
            <Input
              type="date"
              value={value.dueDate}
              onChange={(e) => setValue((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>
        </div>

        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Item Invoice
            </span>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Tambah baris
            </button>
          </div>
          <div className="space-y-2 p-2">
            {value.lines.map((l) => (
              <div key={l.id} className="grid grid-cols-12 items-center gap-2">
                <Input
                  value={l.description}
                  onChange={(e) => setLine(l.id, "description", e.target.value)}
                  placeholder="Deskripsi item"
                  className="col-span-5 h-8"
                />
                <Input
                  type="number"
                  min={0}
                  value={l.qty || ""}
                  onChange={(e) => setLine(l.id, "qty", e.target.value)}
                  placeholder="Qty"
                  className="col-span-2 h-8 tabular-nums"
                />
                <Input
                  type="number"
                  min={0}
                  value={l.unitPrice || ""}
                  onChange={(e) => setLine(l.id, "unitPrice", e.target.value)}
                  placeholder="Harga"
                  className="col-span-3 h-8 tabular-nums"
                />
                <div className="col-span-1 text-right text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(Math.max(0, l.qty) * Math.max(0, l.unitPrice))}
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(l.id)}
                  className="col-span-1 flex justify-center text-muted-foreground hover:text-rose-600"
                  aria-label="Hapus baris"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {touched && validLines.length === 0 && (
              <p className="text-[11px] text-rose-600">Minimal satu item dengan deskripsi & qty.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Tile label="Subtotal" value={formatCurrency(computed.subtotal)} />
          <Tile label={computed.taxLabel} value={formatCurrency(computed.tax)} />
          <Tile label="Net Invoice" value={formatCurrency(computed.net)} highlight />
        </div>
      </div>
    </Dialog>
  );
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-md border p-2.5", highlight ? "border-primary/30 bg-primary/5" : "bg-background")}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
