import { NextResponse } from "next/server";
import { all, nowIso, run } from "@/lib/db";
import { REACTION_EMOJI } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface ReactionRow {
  player_id: number;
  name: string;
  emoji: string;
  count: number;
}

function load(sessionId: number) {
  return all<ReactionRow>(
    `SELECT r.player_id, p.name, r.emoji, r.count
       FROM session_reactions r JOIN players p ON p.id = r.player_id
      WHERE r.session_id = ? AND r.count > 0
      ORDER BY r.count DESC`,
    sessionId,
  );
}

/** Polled every couple of seconds by the reveal screen (§7) — no websockets needed. */
export async function GET(_req: Request, { params }: Ctx) {
  return NextResponse.json({ reactions: load(Number((await params).id)) });
}

export async function POST(req: Request, { params }: Ctx) {
  const sessionId = Number((await params).id);
  const body = await req.json().catch(() => null);
  const playerId = Number(body?.player_id);
  const emoji = String(body?.emoji ?? "");
  const by = Math.max(1, Math.min(25, Number(body?.by ?? 1))); // batched taps

  if (!playerId || !REACTION_EMOJI.includes(emoji as (typeof REACTION_EMOJI)[number]))
    return NextResponse.json({ error: "Unknown reaction." }, { status: 400 });

  // Spammable by design: every tap increments a tally rather than replacing one.
  run(
    `INSERT INTO session_reactions (session_id, player_id, emoji, count, last_updated)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_id, player_id, emoji)
     DO UPDATE SET count = session_reactions.count + excluded.count,
                   last_updated = excluded.last_updated`,
    sessionId,
    playerId,
    emoji,
    by,
    nowIso(),
  );

  return NextResponse.json({ reactions: load(sessionId) });
}
