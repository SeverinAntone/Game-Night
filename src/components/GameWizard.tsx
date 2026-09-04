"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CRIBBAGE_STYLE_SUGGESTION, VariantEditor } from "./VariantEditor";
import type { RatingDimension, ResultMode, ScoringMode, Variant } from "@/lib/types";

/**
 * The New Game wizard (§5). A handful of plain-language questions, asked once
 * per game, that produce the config object the rest of the app reads. Nothing
 * here is re-asked when a session is logged.
 */

interface BggResult {
  id: number;
  name: string;
  year: number | null;
}

const MODE_OPTIONS: { value: ScoringMode; title: string; blurb: string; icon: string }[] = [
  {
    value: "ranked-ffa",
    title: "Everyone for themselves",
    blurb: "Players finish 1st, 2nd, 3rd… Wingspan, Catan, Azul.",
    icon: "🎯",
  },
  {
    value: "team-vs-team",
    title: "Fixed teams",
    blurb: "Two or more declared teams play against each other. Codenames.",
    icon: "🤝",
  },
  {
    value: "hidden-team",
    title: "Hidden roles",
    blurb: "Secret sides revealed at the end. Avalon, Secret Hitler.",
    icon: "🕵️",
  },
  {
    value: "coop-vs-game",
    title: "Everyone vs. the game",
    blurb: "Pure co-op. Pandemic, Forbidden Island. Never rated.",
    icon: "🧩",
  },
];

export function GameWizard({ bggEnabled = false }: { bggEnabled?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [bgg, setBgg] = useState<{ id: number; thumbnail: string | null; year: number | null; min: number | null; max: number | null; weight: number | null } | null>(null);
  const [results, setResults] = useState<BggResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [bggError, setBggError] = useState<string | null>(null);

  const [mode, setMode] = useState<ScoringMode>("ranked-ffa");
  const [tracksScore, setTracksScore] = useState(true);
  const [highScoreWins, setHighScoreWins] = useState(true);
  const [dimension, setDimension] = useState<RatingDimension>("none");
  const [tagLabel, setTagLabel] = useState("Role");
  const [tagText, setTagText] = useState("");
  const [tagsPerPlayer, setTagsPerPlayer] = useState(2);
  const [tracksDifficulty, setTracksDifficulty] = useState(false);
  const [minPlayers, setMinPlayers] = useState("2");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [allowsTeams, setAllowsTeams] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [resultMode, setResultMode] = useState<ResultMode>("ranked");
  const [rated, setRated] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = tagText
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

  async function searchBgg() {
    if (!name.trim()) return;
    setSearching(true);
    setBggError(null);
    try {
      const res = await fetch(`/api/bgg?q=${encodeURIComponent(name.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results);
    } catch (e) {
      setBggError(e instanceof Error ? e.message : "BGG lookup failed.");
    } finally {
      setSearching(false);
    }
  }

  async function pickBgg(r: BggResult) {
    setName(r.name);
    setResults(null);
    try {
      const res = await fetch(`/api/bgg?id=${r.id}`);
      const d = await res.json();
      if (res.ok) {
        setBgg({
          id: r.id,
          thumbnail: d.thumbnail,
          year: d.year,
          min: d.min_players,
          max: d.max_players,
          weight: d.weight,
        });
        // BGG's counts are only defaults — the inputs below stay editable.
        if (d.min_players) setMinPlayers(String(d.min_players));
        if (d.max_players) setMaxPlayers(String(d.max_players));
      }
    } catch {
      setBgg({ id: r.id, thumbnail: null, year: r.year, min: null, max: null, weight: null });
    }
  }

  function chooseMode(m: ScoringMode) {
    setMode(m);
    // Sensible defaults per mode — every one of them stays editable.
    if (m === "hidden-team") {
      setDimension("single-tag");
      setTagLabel("Role");
      if (!tagText) setTagText("Good, Evil");
      setTracksScore(false);
    } else if (m === "coop-vs-game") {
      setDimension("none");
      setTracksScore(false);
      setTracksDifficulty(true);
    } else if (m === "team-vs-team") {
      setDimension("none");
      setTracksScore(true);
    }
    setStep(2);
  }

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        bgg_id: bgg?.id ?? null,
        thumbnail: bgg?.thumbnail ?? null,
        year: bgg?.year ?? null,
        weight: bgg?.weight ?? null,
        scoring_mode: mode,
        rating_dimension: dimension,
        tag_pool: tags,
        tag_label: tagLabel,
        tags_per_player: tagsPerPlayer,
        tracks_score: tracksScore,
        tracks_difficulty: tracksDifficulty,
        high_score_wins: highScoreWins,
        allows_teams: allowsTeams,
        result_mode: resultMode,
        rated,
        variants: variants.filter((v) => v.name.trim() !== ""),
        min_players: Number(minPlayers) || null,
        max_players: Number(maxPlayers) || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add the game.");
      return;
    }
    router.push(`/games/${data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-8">
      {/* --- 0: name + optional BGG lookup --------------------------------- */}
      <section className="card p-4">
        <label className="label" htmlFor="game-name">
          What&apos;s the game?
        </label>
        <div className="flex gap-2">
          <input
            id="game-name"
            className="input"
            placeholder="Wingspan"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setBgg(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && searchBgg()}
            autoFocus
          />
          {bggEnabled && (
            <button
              className="btn-ghost shrink-0"
              onClick={searchBgg}
              disabled={searching || !name.trim()}
            >
              {searching ? "…" : "BGG"}
            </button>
          )}
        </div>
        {bggEnabled && (
          <p className="mt-2 text-xs text-mist-400">
            BGG is optional — it only fills in box art, player count and weight.
          </p>
        )}
        {bggError && <p className="mt-2 text-xs text-rose-brand">{bggError}</p>}

        {results && (
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => pickBgg(r)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                >
                  {r.name}{" "}
                  <span className="text-xs text-mist-400">{r.year ? `(${r.year})` : ""}</span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-3 py-2 text-sm text-mist-400">Nothing found — carry on by hand.</li>
            )}
          </ul>
        )}

        {bgg && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
            {bgg.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bgg.thumbnail} alt="" className="size-12 rounded-lg object-cover" />
            ) : null}
            <div className="text-xs text-mist-300">
              <div className="font-semibold text-mist-100">Linked to BGG #{bgg.id}</div>
              <div>
                {[bgg.year, bgg.min && bgg.max ? `${bgg.min}–${bgg.max} players` : null, bgg.weight ? `weight ${bgg.weight.toFixed(1)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button className="ml-auto text-xs text-mist-400" onClick={() => setBgg(null)}>
              unlink
            </button>
          </div>
        )}

        {step === 0 && (
          <button className="btn-primary mt-4 w-full" disabled={!name.trim()} onClick={() => setStep(1)}>
            Next
          </button>
        )}
      </section>

      {/* --- 1: scoring mode ---------------------------------------------- */}
      {step >= 1 && (
        <section className="card animate-rise p-4">
          <div className="label">How does a game of {name || "this"} end?</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => chooseMode(o.value)}
                className={`rounded-xl border p-3 text-left transition ${
                  mode === o.value && step >= 2
                    ? "border-grape-400/60 bg-grape-500/15"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="font-semibold">
                  {o.icon} {o.title}
                </div>
                <div className="mt-0.5 text-xs text-mist-400">{o.blurb}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* --- 2: the per-game questions ------------------------------------ */}
      {step >= 2 && (
        <section className="card animate-rise space-y-5 p-4">
          <div>
            <div className="label">How many players?</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={30}
                aria-label="Minimum players"
                className="input w-20 text-center"
                value={minPlayers}
                onChange={(e) => setMinPlayers(e.target.value)}
              />
              <span className="text-sm text-mist-400">to</span>
              <input
                type="number"
                min={1}
                max={30}
                aria-label="Maximum players"
                className="input w-20 text-center"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
            </div>
            <p className="mt-2 text-xs text-mist-400">
              Only used to flag an odd-sized table when you log a session — it never blocks you.
            </p>
          </div>

          {mode === "ranked-ffa" && (
            <Toggle
              label="Is it sometimes played in partnerships?"
              hint="Adds an optional team picker at session entry; leaving everyone Solo behaves exactly as before."
              value={allowsTeams}
              onChange={setAllowsTeams}
            />
          )}

          <Toggle
            label="Should it count toward ratings?"
            hint="Turn this off for games where winning isn't really a skill — party games with a judge, or anything decided by a shuffle. They're still logged for plays, streaks and the calendar."
            value={rated}
            onChange={setRated}
          />

          <div className="rounded-xl border border-white/8 bg-ink-900/40 p-3">
            <VariantEditor
              variants={variants}
              onChange={setVariants}
              suggestion={CRIBBAGE_STYLE_SUGGESTION}
            />
          </div>

          {mode !== "coop-vs-game" && (
            <div>
              <div className="label">How does it end?</div>
              <div className="grid gap-2">
                {(
                  [
                    {
                      v: "ranked",
                      t: "There's a real 2nd and 3rd",
                      b: "Everyone finishes and can be placed in order — final scoring, or an elimination order that says who lasted longer. Wingspan, Azul, Risk.",
                    },
                    {
                      v: "winner-only",
                      t: "Someone wins, everyone else loses",
                      b: "It ends the moment it's decided and the rest aren't comparable. Coup, Cryptid, Fluxx.",
                    },
                  ] as { v: ResultMode; t: string; b: string }[]
                ).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setResultMode(o.v)}
                    className={`rounded-xl border p-3 text-left transition ${
                      resultMode === o.v
                        ? "border-grape-400/60 bg-grape-500/15"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="text-sm font-semibold">{o.t}</div>
                    <div className="mt-0.5 text-xs text-mist-400">{o.b}</div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-mist-400">
                Nothing to do with scores — this is only about whether losing places mean anything.
                Pick &quot;winner takes it&quot; if you&apos;d have to invent the order.
              </p>
            </div>
          )}

          <Toggle
            label="Does it report a numeric score?"
            hint="Stored for personal bests and high-score charts. Never fed to the rating engine."
            value={tracksScore}
            onChange={setTracksScore}
          />

          {tracksScore && (
            <div className="pl-1">
              <div className="label">Which score wins?</div>
              <div className="flex gap-2">
                {[
                  { v: true, l: "Highest wins" },
                  { v: false, l: "Lowest wins" },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    onClick={() => setHighScoreWins(o.v)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      highScoreWins === o.v
                        ? "bg-grape-500/25 text-grape-200 ring-1 ring-grape-400/40"
                        : "bg-white/5 text-mist-400"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "coop-vs-game" ? (
            <Toggle
              label="Does difficulty vary between plays?"
              hint="Free text on this game's own scale — epidemics, scenario level, whatever it uses."
              value={tracksDifficulty}
              onChange={setTracksDifficulty}
            />
          ) : (
            <div>
              <div className="label">Do players have roles or identities worth rating separately?</div>
              <div className="grid gap-2">
                {(
                  [
                    { v: "none", t: "No — one rating per player", b: "Most games. Wingspan, Catan." },
                    {
                      v: "single-tag",
                      t: "One role each",
                      b: "Each role becomes its own rating pool. Avalon: Good and Evil.",
                    },
                    {
                      v: "multi-tag",
                      t: "Several identities each",
                      b: "Rated per identity, not per combo. Smash Up factions.",
                    },
                  ] as { v: RatingDimension; t: string; b: string }[]
                ).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => {
                      setDimension(o.v);
                      if (o.v === "multi-tag" && tagLabel === "Role") setTagLabel("Faction");
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      dimension === o.v
                        ? "border-grape-400/60 bg-grape-500/15"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="text-sm font-semibold">{o.t}</div>
                    <div className="mt-0.5 text-xs text-mist-400">{o.b}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {dimension !== "none" && (
            <div className="space-y-3 rounded-xl border border-white/8 bg-ink-900/60 p-3">
              <div>
                <label className="label" htmlFor="tag-label">
                  What are they called?
                </label>
                <input
                  id="tag-label"
                  className="input"
                  value={tagLabel}
                  onChange={(e) => setTagLabel(e.target.value)}
                  placeholder="Role / Faction / Character"
                />
              </div>
              <div>
                <label className="label" htmlFor="tag-pool">
                  List them (comma separated)
                </label>
                <textarea
                  id="tag-pool"
                  className="input min-h-20"
                  value={tagText}
                  onChange={(e) => setTagText(e.target.value)}
                  placeholder="Good, Evil"
                />
                <p className="mt-1 text-xs text-mist-400">
                  {tags.length} {tagLabel.toLowerCase()}
                  {tags.length === 1 ? "" : "s"} — you can add more later.
                </p>
              </div>
              {dimension === "multi-tag" && (
                <div>
                  <label className="label" htmlFor="per-player">
                    How many per player, per game?
                  </label>
                  <input
                    id="per-player"
                    type="number"
                    min={1}
                    max={6}
                    className="input w-24"
                    value={tagsPerPlayer}
                    onChange={(e) => setTagsPerPlayer(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              )}
            </div>
          )}

          <ConfigPreview
            config={{
              name: name || "…",
              players: `${minPlayers}–${maxPlayers}`,
              scoring_mode: mode,
              result_mode: mode === "coop-vs-game" ? undefined : resultMode,
              rated,
              rating_dimension: dimension,
              tag_pool: dimension === "none" ? undefined : tags,
              allows_teams: mode === "ranked-ffa" ? allowsTeams : undefined,
              tracks_score: tracksScore,
              tracks_difficulty: mode === "coop-vs-game" ? tracksDifficulty : false,
            }}
          />

          {error && <p className="text-sm text-rose-brand">{error}</p>}

          <button className="btn-primary w-full" onClick={create} disabled={busy || !name.trim()}>
            {busy ? "Adding…" : "Add to the shelf"}
          </button>
        </section>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-mist-400">{hint}</div>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          value ? "bg-grape-500" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white transition-all ${
            value ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function ConfigPreview({ config }: { config: Record<string, unknown> }) {
  return (
    <details className="rounded-xl border border-white/8 bg-ink-950/60 p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-mist-400">
        Config object
      </summary>
      <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-mist-300">
        {JSON.stringify(config, null, 2)}
      </pre>
    </details>
  );
}
