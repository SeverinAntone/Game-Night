"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CRIBBAGE_STYLE_SUGGESTION, VariantEditor } from "./VariantEditor";
import { gameVariants, tagPool, type Game, type RatingDimension, type Variant } from "@/lib/types";

/**
 * Post-hoc config tweaks (§11: "sanity-check the wizard questions against real
 * games"). Adding a faction you forgot shouldn't mean re-adding the game.
 */
export function GameConfigEditor({ game }: { game: Game }) {
  const router = useRouter();
  const [name, setName] = useState(game.name);
  const [tagText, setTagText] = useState(tagPool(game).join(", "));
  const [tagLabel, setTagLabel] = useState(game.tag_label ?? "Role");
  // Dimension itself only moves off "none" here — a game that already rates
  // by role/faction keeps that shape fixed, same as scoring_mode. Turning
  // tags on for the first time is safe: sessions logged before today just
  // have no tag, so they're skipped by the new pool rather than misfiled
  // into it (see replayRatings()) — the overall leaderboard never changes.
  const [dimension, setDimension] = useState<RatingDimension>(game.rating_dimension);
  const [tagsPerPlayer, setTagsPerPlayer] = useState(game.tags_per_player || 1);
  const [tracksScore, setTracksScore] = useState(!!game.tracks_score);
  const [allowsTeams, setAllowsTeams] = useState(!!game.allows_teams);
  const [resultMode, setResultMode] = useState(game.result_mode);
  const [rated, setRated] = useState(!!game.rated);
  const [variants, setVariants] = useState<Variant[]>(gameVariants(game));
  const [minPlayers, setMinPlayers] = useState(game.min_players ? String(game.min_players) : "");
  const [maxPlayers, setMaxPlayers] = useState(game.max_players ? String(game.max_players) : "");
  const [highScoreWins, setHighScoreWins] = useState(!!game.high_score_wins);
  const [tracksDifficulty, setTracksDifficulty] = useState(!!game.tracks_difficulty);
  const [retired, setRetired] = useState(!!game.retired);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus(null);
    const res = await fetch(`/api/games/${game.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        rating_dimension: dimension,
        tag_label: tagLabel || null,
        tag_pool: tagText
          .split(/[,\n]/)
          .map((t) => t.trim())
          .filter(Boolean),
        tags_per_player: dimension === "multi-tag" ? tagsPerPlayer : 1,
        tracks_score: tracksScore,
        high_score_wins: highScoreWins,
        tracks_difficulty: tracksDifficulty,
        allows_teams: allowsTeams,
        result_mode: resultMode,
        rated,
        variants: variants.filter((v) => v.name.trim() !== ""),
        min_players: minPlayers === "" ? undefined : Number(minPlayers),
        max_players: maxPlayers === "" ? undefined : Number(maxPlayers),
        retired,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setStatus(res.ok ? "Saved." : (data.error ?? "Could not save."));
    if (res.ok) router.refresh();
  }

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-mist-400">
        Game settings
      </summary>

      <div className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="g-name">
            Name
          </label>
          <input id="g-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {game.rating_dimension === "none" ? (
          <div className="rounded-xl border border-white/8 bg-ink-900/40 p-3">
            <div className="label">Rate players by role or identity?</div>
            <p className="mb-2 text-xs text-mist-400">
              Splits the leaderboard into one ranking per role — e.g. a 2-vs-1 side each with its
              own pool — on top of the overall leaderboard, which is untouched either way. Sessions
              already logged won&apos;t retroactively get a role; only ones you tag from now on.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  { v: "none" as const, t: "No", b: "Leave it as one rating per player." },
                  { v: "single-tag" as const, t: "One role each", b: "e.g. Solo vs. Duo." },
                  { v: "multi-tag" as const, t: "Several each", b: "e.g. multiple factions." },
                ]
              ).map((o) => (
                <button
                  key={o.v}
                  onClick={() => setDimension(o.v)}
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

            {dimension !== "none" && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label" htmlFor="g-tag-label">
                    {dimension === "single-tag" ? "Role" : "Identity"} label
                  </label>
                  <input
                    id="g-tag-label"
                    className="input"
                    value={tagLabel}
                    onChange={(e) => setTagLabel(e.target.value)}
                    placeholder="Role / Side / Faction"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="g-tags">
                    Pool (comma separated)
                  </label>
                  <textarea
                    id="g-tags"
                    className="input min-h-20"
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    placeholder="Solo, Duo"
                  />
                </div>
                {dimension === "multi-tag" && (
                  <div>
                    <label className="label" htmlFor="g-tags-per-player">
                      How many per player, per game?
                    </label>
                    <input
                      id="g-tags-per-player"
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
          </div>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="g-tag-label">
                {game.rating_dimension === "single-tag" ? "Role" : "Identity"} label
              </label>
              <input
                id="g-tag-label"
                className="input"
                value={tagLabel}
                onChange={(e) => setTagLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="g-tags">
                Pool (comma separated)
              </label>
              <textarea
                id="g-tags"
                className="input min-h-20"
                value={tagText}
                onChange={(e) => setTagText(e.target.value)}
              />
              <p className="mt-1 text-xs text-mist-400">
                Adding is safe. Removing one hides it from future entry; past sessions keep theirs.
              </p>
            </div>
          </>
        )}

        <div>
          <div className="label">Player count</div>
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
        </div>

        {game.scoring_mode !== "coop-vs-game" && (
          <div>
            <div className="label">How it ends</div>
            <div className="flex gap-2">
              {(
                [
                  { v: "ranked" as const, l: "Real 2nd and 3rd" },
                  { v: "winner-only" as const, l: "Winner takes it" },
                ]
              ).map((o) => (
                <button
                  key={o.v}
                  onClick={() => setResultMode(o.v)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    resultMode === o.v
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

        <div className="rounded-xl border border-white/8 bg-ink-900/40 p-3">
          <VariantEditor
            variants={variants}
            onChange={setVariants}
            suggestion={CRIBBAGE_STYLE_SUGGESTION}
          />
        </div>

        <div className="space-y-2">
          <Check label="Tracks a numeric score" value={tracksScore} onChange={setTracksScore} />
          {game.scoring_mode === "ranked-ffa" && (
            <Check
              label="Sometimes played in partnerships"
              value={allowsTeams}
              onChange={setAllowsTeams}
            />
          )}
          {tracksScore && (
            <Check label="Highest score wins" value={highScoreWins} onChange={setHighScoreWins} />
          )}
          {game.scoring_mode === "coop-vs-game" && (
            <Check label="Tracks difficulty" value={tracksDifficulty} onChange={setTracksDifficulty} />
          )}
          <Check label="Counts toward ratings" value={rated} onChange={setRated} />
          <Check label="Retired (hide from session entry)" value={retired} onChange={setRetired} />
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
          {status && <span className="text-xs text-mist-400">{status}</span>}
        </div>

        <p className="text-xs text-mist-400">
          Scoring mode is fixed after creation, and once a role/identity pool exists its shape
          (single vs. several per player) is too — both change how the whole history is rated. If
          one is genuinely wrong, add the game again and re-log, or ask for a replay from Settings.
        </p>
      </div>
    </details>
  );
}

function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[#8b5cf6]"
      />
      {label}
    </label>
  );
}
