"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { PERSONAS } from "@/lib/personas";

type AppUser = {
  id: string;
  email: string;
  name: string;
  personaId: string;
  roleLabel: string;
  role: string;
  isActive: boolean;
};

type FormState = { id?: string; name: string; email: string; personaId: string; password: string; isActive: boolean };

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  personaId: PERSONAS[0].id,
  password: "",
  isActive: true,
};

/**
 * Kelola Akun Login — Super Admin only. Manage the DB-backed sign-in accounts:
 * create, edit (name/email/role/active), reset password, delete. The Super Admin
 * edits their own login here too (their row in the list).
 */
export function KelolaAkunClient() {
  const { persona } = usePersona();
  const isSuper = persona.role === "super_admin";

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [pwUser, setPwUser] = useState<AppUser | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account-users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat.");
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuper) void load();
    else setLoading(false);
  }, [isSuper, load]);

  if (!isSuper) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kelola Akun Login" description="Manajemen akun login pengguna." />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ShieldAlert className="h-8 w-8 text-amber-500" />
            <p className="text-sm font-medium">Halaman ini khusus Super Admin.</p>
            <p className="text-xs text-muted-foreground">Hubungi Super Admin untuk mengubah akun Anda.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(u: AppUser) {
    setForm({ id: u.id, name: u.name, email: u.email, personaId: u.personaId, password: "", isActive: u.isActive });
    setFormError("");
    setFormOpen(true);
  }

  async function submitForm() {
    setSaving(true);
    setFormError("");
    try {
      const isEdit = Boolean(form.id);
      const url = isEdit ? `/api/account-users/${form.id}` : "/api/account-users";
      const method = isEdit ? "PATCH" : "POST";
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        personaId: form.personaId,
        isActive: form.isActive,
      };
      if (!isEdit) payload.password = form.password;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan.");
      setNotice(isEdit ? "Perubahan disimpan." : "Pengguna ditambahkan.");
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function submitPassword() {
    if (!pwUser) return;
    setPwSaving(true);
    setPwError("");
    try {
      const res = await fetch(`/api/account-users/${pwUser.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal.");
      setNotice(`Kata sandi ${pwUser.name} diperbarui.`);
      setPwUser(null);
      setPwValue("");
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Gagal mengubah kata sandi.");
    } finally {
      setPwSaving(false);
    }
  }

  async function remove(u: AppUser) {
    if (!window.confirm(`Hapus akun ${u.name} (${u.email})?`)) return;
    setError("");
    try {
      const res = await fetch(`/api/account-users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus.");
      setNotice(`Akun ${u.name} dihapus.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelola Akun Login"
        description="Tambah, ubah, reset kata sandi, dan hapus akun login pengguna. Khusus Super Admin."
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Tambah Pengguna
          </Button>
        }
      />
      <PersonaBanner persona={persona} scopeSummary="Anda mengelola seluruh akun login" />

      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Akun</CardTitle>
          <CardDescription>Semua akun yang bisa login ke aplikasi.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat…</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada akun.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Nama</th>
                    <th className="px-2 py-2 font-medium">Email</th>
                    <th className="px-2 py-2 font-medium">Peran</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium">{u.name}</td>
                      <td className="px-2 py-2 text-muted-foreground">{u.email}</td>
                      <td className="px-2 py-2">
                        <Badge variant="muted">{u.roleLabel}</Badge>
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant={u.isActive ? "success" : "danger"}>{u.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(u)} className="gap-1">
                            <Pencil className="h-3.5 w-3.5" /> Ubah
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setPwUser(u); setPwValue(""); setPwError(""); }} className="gap-1">
                            <KeyRound className="h-3.5 w-3.5" /> Sandi
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(u)} className="gap-1 text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" /> Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Ubah Pengguna" : "Tambah Pengguna"}
        description={form.id ? "Perbarui data akun login." : "Buat akun login baru."}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={submitForm} disabled={saving} className="gap-1.5">
              <Plus className="h-4 w-4" /> {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nama</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama lengkap" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Email (untuk login)</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@tpb.co.id" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Peran / Akses</label>
            <select
              value={form.personaId}
              onChange={(e) => setForm({ ...form, personaId: e.target.value })}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.roleLabel}
                </option>
              ))}
            </select>
          </div>
          {!form.id && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Kata Sandi Awal</label>
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimal 6 karakter"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4"
            />
            Akun aktif (boleh login)
          </label>
          {formError && <p className="text-xs text-rose-600">{formError}</p>}
        </div>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog
        open={Boolean(pwUser)}
        onClose={() => setPwUser(null)}
        title="Ubah Kata Sandi"
        description={pwUser ? `Akun: ${pwUser.name} (${pwUser.email})` : ""}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPwUser(null)} disabled={pwSaving}>
              Batal
            </Button>
            <Button onClick={submitPassword} disabled={pwSaving} className="gap-1.5">
              <KeyRound className="h-4 w-4" /> {pwSaving ? "Menyimpan…" : "Simpan Sandi"}
            </Button>
          </div>
        }
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Kata Sandi Baru</label>
          <Input type="text" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="Minimal 6 karakter" />
          {pwError && <p className="text-xs text-rose-600">{pwError}</p>}
        </div>
      </Dialog>
    </div>
  );
}
