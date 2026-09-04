import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Thin BoardGameGeek XMLAPI2 proxy (design doc §11): box art, player count,
 * year and weight as *defaults* for the New Game wizard. Purely optional — the
 * wizard works fine offline, and nothing here feeds the rating engine.
 *
 * Only runs when someone taps "Search BGG", and only sends the typed title.
 */

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

const attr = (chunk: string, name: string) =>
  chunk.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;

class BggError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * BGG closed the XML API to anonymous callers — every request now needs a
 * token from their developer registration. Put it in `.env.local` as
 * BGG_TOKEN and this starts working; leave it unset and the wizard just tells
 * you to fill the fields in by hand.
 */
const TOKEN = process.env.BGG_TOKEN?.trim();

async function fetchBgg(url: string) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "board-game-night-tracker (self-hosted)",
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!res.ok) throw new BggError(`BGG returned ${res.status}`, res.status);
  return res.text();
}

/**
 * As of 2026 the XML API answers 401 to unauthenticated clients, so say so
 * plainly rather than making someone wonder whether their wifi is broken.
 */
function explain(e: unknown): string {
  if (e instanceof BggError && (e.status === 401 || e.status === 403))
    return TOKEN
      ? "BGG rejected the API token — check BGG_TOKEN in .env.local, or fill the details in by hand."
      : "BGG's API needs a token now. Register at boardgamegeek.com/using_the_xml_api and put it in .env.local as BGG_TOKEN — or just fill the details in by hand.";
  if (e instanceof Error && e.name === "TimeoutError")
    return "BGG didn't answer in time — fill the details in by hand.";
  return "BGG lookup failed — fill the details in by hand.";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const id = url.searchParams.get("id");

  try {
    if (id) {
      const xml = await fetchBgg(`https://boardgamegeek.com/xmlapi2/thing?id=${Number(id)}&stats=1`);
      const name = xml.match(/<name[^>]*type="primary"[^>]*value="([^"]*)"/)?.[1];
      return NextResponse.json({
        id: Number(id),
        name: name ? decode(name) : null,
        thumbnail: xml.match(/<thumbnail>([^<]*)<\/thumbnail>/)?.[1] ?? null,
        year: Number(xml.match(/<yearpublished[^>]*value="(\d+)"/)?.[1]) || null,
        min_players: Number(xml.match(/<minplayers[^>]*value="(\d+)"/)?.[1]) || null,
        max_players: Number(xml.match(/<maxplayers[^>]*value="(\d+)"/)?.[1]) || null,
        weight: Number(xml.match(/<averageweight[^>]*value="([\d.]+)"/)?.[1]) || null,
      });
    }

    if (!q) return NextResponse.json({ results: [] });

    const xml = await fetchBgg(
      `https://boardgamegeek.com/xmlapi2/search?type=boardgame&query=${encodeURIComponent(q)}`,
    );
    const results = [...xml.matchAll(/<item[^>]*>[\s\S]*?<\/item>|<item[^>]*\/>/g)]
      .map((m) => {
        const chunk = m[0];
        const name = chunk.match(/<name[^>]*value="([^"]*)"/)?.[1];
        return {
          id: Number(attr(chunk, "id")),
          name: name ? decode(name) : "",
          year: Number(chunk.match(/<yearpublished[^>]*value="(\d+)"/)?.[1]) || null,
        };
      })
      .filter((r) => r.id && r.name)
      .slice(0, 12);

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: explain(e), detail: String(e) }, { status: 502 });
  }
}
