import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/apiAuth";
import { logChange } from "@/lib/changelog";
import { getDb, nowIso, run } from "@/lib/db";
import { replayRatings } from "@/lib/recompute";

export const dynamic = "force-dynamic";

const DATA_DIR = process.env.BGN_DATA_DIR ?? path.join(process.cwd(), "data");

export async function POST(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  const body = await req.json().catch(() => ({}));

  switch (body.action) {
    case "recompute": {
      const result = replayRatings();
      logChange(actor, "admin.recompute", "Replayed all ratings from scratch");
      return NextResponse.json({ ok: true, ...result });
    }

    case "backup": {
      // SQLite's own backup API — safe to run while the app is live.
      const dir = path.join(DATA_DIR, "backups");
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `boardgames-${nowIso().replace(/[:.]/g, "-")}.db`);
      await getDb().backup(file);
      logChange(actor, "admin.backup", "Backed up the database");
      return NextResponse.json({ ok: true, file });
    }

    case "new-season": {
      // Seasons soft-reset ratings; deliberately a manual admin action (§11).
      const name = String(body.name ?? "").trim() || `Season ${new Date().getFullYear()}`;
      run("UPDATE seasons SET active = 0, ended_at = ? WHERE active = 1", nowIso());
      run("INSERT INTO seasons (name, started_at, active) VALUES (?, ?, 1)", name, nowIso());
      logChange(actor, "admin.new-season", `Started a new season: ${name}`);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
