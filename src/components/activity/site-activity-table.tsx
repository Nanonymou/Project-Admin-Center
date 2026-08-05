import { Badge } from "@/components/ui/badge";
import type { SiteActivity } from "@/lib/mock/activity";
import { formatNumber } from "@/lib/utils";

const STATUS_VARIANT: Record<SiteActivity["status"], { label: string; variant: "success" | "warning" | "danger" }> = {
  healthy: { label: "Healthy", variant: "success" },
  watch: { label: "Watch", variant: "warning" },
  critical: { label: "Critical", variant: "danger" },
};

export function SiteActivityTable({ rows }: { rows: SiteActivity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">Project</th>
            <th className="px-4 py-2.5 text-left font-medium">Location</th>
            <th className="px-4 py-2.5 text-right font-medium">Transaksi</th>
            <th className="px-4 py-2.5 text-right font-medium">Pending</th>
            <th className="px-4 py-2.5 text-right font-medium">SLA</th>
            <th className="px-4 py-2.5 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = STATUS_VARIANT[row.status];
            return (
              <tr
                key={`${row.project}-${row.location}`}
                className="border-b last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-2.5 font-medium">{row.project}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.location}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(row.transactions)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.pending}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <div className="inline-flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded bg-muted">
                      <div
                        className={
                          row.slaPct >= 90
                            ? "h-full bg-emerald-500"
                            : row.slaPct >= 80
                              ? "h-full bg-amber-500"
                              : "h-full bg-rose-500"
                        }
                        style={{ width: `${row.slaPct}%` }}
                      />
                    </div>
                    <span className="w-10 text-xs">{row.slaPct}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
