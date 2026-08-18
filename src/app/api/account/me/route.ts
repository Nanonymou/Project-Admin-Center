import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { appUsers } from "@/db/schema/app-users";
import { getPersonaById } from "@/lib/personas";
import { parseLocations } from "@/lib/server/app-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account/me — the signed-in account's live identity from the DB.
 *
 * Lets the UI show the real name/email/role (reflecting changes a Super Admin
 * made) instead of the value cached in the JWT. Returns 401 when the session is
 * missing, or when the account was deleted or deactivated — the client then
 * signs the user out.
 */
export async function GET() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const [row] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
    if (!row || !row.isActive) return NextResponse.json({ error: "inactive" }, { status: 401 });
    const persona = getPersonaById(row.personaId);
    return NextResponse.json({
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        personaId: row.personaId,
        role: persona.role,
        roleLabel: persona.roleLabel,
        locations: parseLocations(row.locations),
      },
    });
  } catch {
    // DB transiently unreachable — do not force a logout; return no override.
    return NextResponse.json({ user: null, transient: true });
  }
}
