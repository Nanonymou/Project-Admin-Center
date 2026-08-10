/**
 * System parameters (config-driven) for the Parameter Sistem page. These are
 * global, application-level settings — distinct from per-project business config
 * (tax, pricing, workflow). Each parameter is typed so the UI can render the
 * right control and validate edits. Frontend-first: this is the mock the page
 * drives until the parameters API and history tables land.
 */

export type ParameterType = "number" | "text" | "boolean" | "select";

export type ParameterGroup = "Umum" | "Keuangan" | "Notifikasi" | "Keamanan" | "Penyimpanan";

export type SystemParameter = {
  key: string;
  label: string;
  group: ParameterGroup;
  type: ParameterType;
  value: string | number | boolean;
  /** Unit suffix for number params (e.g. "hari", "MB"). */
  unit?: string;
  description: string;
  /** Bounds for number params. */
  min?: number;
  max?: number;
  /** Options for select params. */
  options?: { value: string; label: string }[];
};

export const PARAMETER_GROUPS: ParameterGroup[] = [
  "Umum",
  "Keuangan",
  "Notifikasi",
  "Keamanan",
  "Penyimpanan",
];

const SYSTEM_PARAMETERS: SystemParameter[] = [
  {
    key: "app_name",
    label: "Nama Aplikasi",
    group: "Umum",
    type: "text",
    value: "Project Admin Center",
    description: "Nama yang ditampilkan pada header dan judul halaman.",
  },
  {
    key: "default_locale",
    label: "Bahasa Default",
    group: "Umum",
    type: "select",
    value: "id",
    description: "Bahasa antarmuka default untuk pengguna baru.",
    options: [
      { value: "id", label: "Indonesia" },
      { value: "en", label: "English" },
    ],
  },
  {
    key: "date_format",
    label: "Format Tanggal",
    group: "Umum",
    type: "select",
    value: "dd/MM/yyyy",
    description: "Format tampilan tanggal di seluruh aplikasi.",
    options: [
      { value: "dd/MM/yyyy", label: "31/12/2025" },
      { value: "yyyy-MM-dd", label: "2025-12-31" },
      { value: "dd MMM yyyy", label: "31 Des 2025" },
    ],
  },
  {
    key: "currency",
    label: "Mata Uang",
    group: "Keuangan",
    type: "select",
    value: "IDR",
    description: "Mata uang default untuk nilai finansial.",
    options: [{ value: "IDR", label: "Rupiah (IDR)" }],
  },
  {
    key: "invoice_number_format",
    label: "Format Nomor Invoice",
    group: "Keuangan",
    type: "text",
    value: "INV/{YYYY}/{MM}/{SEQ}",
    description: "Pola penomoran otomatis dokumen invoice.",
  },
  {
    key: "sla_warning_threshold",
    label: "Ambang Peringatan SLA",
    group: "Keuangan",
    type: "number",
    value: 80,
    unit: "%",
    min: 0,
    max: 100,
    description: "Persentase SLA terpakai sebelum status berubah kuning.",
  },
  {
    key: "reminder_lead_days",
    label: "Lead Time Reminder",
    group: "Notifikasi",
    type: "number",
    value: 3,
    unit: "hari",
    min: 0,
    max: 30,
    description: "Berapa hari sebelum jatuh tempo reminder dikirim.",
  },
  {
    key: "email_notifications",
    label: "Notifikasi Email",
    group: "Notifikasi",
    type: "boolean",
    value: true,
    description: "Kirim notifikasi penting melalui email.",
  },
  {
    key: "session_timeout_min",
    label: "Batas Sesi Idle",
    group: "Keamanan",
    type: "number",
    value: 30,
    unit: "menit",
    min: 5,
    max: 240,
    description: "Durasi idle sebelum sesi pengguna berakhir otomatis.",
  },
  {
    key: "enforce_2fa",
    label: "Wajib 2FA",
    group: "Keamanan",
    type: "boolean",
    value: false,
    description: "Wajibkan autentikasi dua faktor untuk semua admin.",
  },
  {
    key: "recycle_retention_days",
    label: "Retensi Recycle Bin",
    group: "Penyimpanan",
    type: "number",
    value: 30,
    unit: "hari",
    min: 1,
    max: 365,
    description: "Lama data terhapus disimpan sebelum dibersihkan permanen.",
  },
  {
    key: "max_upload_mb",
    label: "Maks. Ukuran Unggah",
    group: "Penyimpanan",
    type: "number",
    value: 25,
    unit: "MB",
    min: 1,
    max: 200,
    description: "Batas ukuran file untuk lampiran dan bukti.",
  },
];

export function listSystemParameters(): SystemParameter[] {
  return SYSTEM_PARAMETERS;
}

export function getSystemParameter(key: string): SystemParameter | undefined {
  return SYSTEM_PARAMETERS.find((p) => p.key === key);
}

/** Format a parameter value for display, honoring its type and unit. */
export function formatParameterValue(p: SystemParameter, value: SystemParameter["value"]): string {
  if (p.type === "boolean") return value ? "Aktif" : "Nonaktif";
  if (p.type === "select") return p.options?.find((o) => o.value === value)?.label ?? String(value);
  if (p.type === "number") return `${value}${p.unit ? ` ${p.unit}` : ""}`;
  return String(value);
}
