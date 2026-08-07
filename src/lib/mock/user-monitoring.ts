/** Mock users for the User & Storage Monitoring page. */
export type UserStatus = "active" | "idle" | "offline";
export type UserRole = "super_admin" | "leader_admin" | "site_admin" | "viewer";

export type MonitoredUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  scope: string;
  status: UserStatus;
  lastActive: string;
  sessions: number;
  storageMb: number;
  uploads: number;
};

export const USER_STATUS_META: Record<UserStatus, { label: string; variant: "success" | "warning" | "muted" }> = {
  active: { label: "Aktif", variant: "success" },
  idle: { label: "Idle", variant: "warning" },
  offline: { label: "Offline", variant: "muted" },
};

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Admin",
  leader_admin: "Leader Admin",
  site_admin: "Site Admin",
  viewer: "Viewer",
};

const NAMES = [
  "Bagas Wicaksono",
  "Ika Rahmawati",
  "Fajar Nugraha",
  "Dinda Ayu",
  "Rizky Pratama",
  "Sinta Dewi",
  "Andi Saputra",
  "Maya Lestari",
  "Yoga Perdana",
  "Nadia Putri",
  "Bayu Setiawan",
  "Citra Anggraini",
];
const SCOPES = ["Seluruh Site", "BUMA · KM22", "POMALA", "PHSS · Muara Badak", "PHKT · Attaka", "BUMA · KM92"];
const ROLES: UserRole[] = ["super_admin", "leader_admin", "site_admin", "site_admin", "viewer"];

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

export type ProjectStorage = {
  code: string;
  name: string;
  usedMb: number;
  quotaMb: number;
  files: number;
};

/** Deterministic storage usage per project. */
export function buildStorageByProject(): ProjectStorage[] {
  const projects = [
    { code: "BUMA", name: "BUMA Tabang", quotaMb: 4096 },
    { code: "POMALA", name: "POMALA", quotaMb: 2048 },
    { code: "PHSS", name: "PHSS", quotaMb: 3072 },
    { code: "PHKT", name: "PHKT", quotaMb: 2048 },
  ];
  return projects.map((p) => {
    const seed = seedOf(p.code);
    const usedMb = Math.round((p.quotaMb * (0.35 + (seed % 55) / 100)) * 10) / 10;
    return { code: p.code, name: p.name, usedMb, quotaMb: p.quotaMb, files: 200 + (seed % 1800) };
  });
}

export function buildUsers(count = 12): MonitoredUser[] {
  const out: MonitoredUser[] = [];
  for (let i = 0; i < count; i++) {
    const seed = seedOf(`user-${i}`);
    const name = NAMES[i % NAMES.length];
    const status: UserStatus = i < 4 ? "active" : seed % 3 === 0 ? "idle" : "offline";
    const mins = seed % 720;
    const lastActive =
      status === "active"
        ? "Sekarang"
        : mins < 60
          ? `${mins} mnt lalu`
          : `${Math.round(mins / 60)} jam lalu`;
    out.push({
      id: `usr-${i}`,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@catering.id`,
      role: ROLES[seed % ROLES.length],
      scope: SCOPES[seed % SCOPES.length],
      status,
      lastActive,
      sessions: 1 + (seed % 4),
      storageMb: Math.round((20 + (seed % 480)) * 10) / 10,
      uploads: 5 + (seed % 120),
    });
  }
  return out;
}
