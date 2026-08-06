"use client";

import { Info } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AttachmentCenter } from "@/components/attachments/attachment-center";
import { usePersona } from "@/components/providers/persona-provider";

export function AttachmentCenterPreviewClient() {
  const { persona } = usePersona();

  return (
    <div>
      <PageHeader
        title="Attachment Center"
        description="Pusat lampiran bukti transaksi — pratinjau komponen yang dipakai di form Daily Sales, Cost & Invoice."
        breadcrumbs={[{ label: "Operasional" }, { label: "Attachment Center" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary="Pratinjau komponen" />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Komponen Attachment Center dapat disematkan di form transaksi mana pun untuk mengunggah
            bukti (gambar/PDF/Excel) dengan pratinjau.
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contoh Form Transaksi</CardTitle>
            <CardDescription>Form dengan Attachment Center tersemat di bagian lampiran.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nomor Referensi</label>
                <Input placeholder="mis. TRX-2026-0001" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Keterangan</label>
                <Input placeholder="Deskripsi transaksi" />
              </div>
            </div>

            <div className="rounded-md border p-3">
              <AttachmentCenter title="Lampiran Bukti" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
