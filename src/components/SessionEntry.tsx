"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "./ui";
import { useMe } from "./useMe";
import {
  effectiveConfig,
  gameVariants,
  type Game,
  type Player,
} from "@/lib/types";

/**
 * Quick session entry (§10): pick game → tap players → drag to order → done.
 * One person logs on behalf of the table, live, in under 30 seconds — so the
 * form only ever shows the fields this game's config actually needs (§5).
 */

interface Row {
  player: Player;
  /** true = tied with the row above (the "same row" case from the design doc) */
  tied: boolean;
  score: string;
  tags: string[];
  team: string;
}

export function SessionEntry({
  games,
  players,
  initial,
  sessionId,
}: {
  games: Game[];
  players: Player[];
  initial?: {
    game_id: number;
    variant: string | null;
    played_at: string;
    notes: string;
    difficulty: string;
    coop_result: "win" | "loss" | null;
    rows: { player_id: number; placement: number; score: number | null; tags: string[]; team: string | null }[];
  };
  sessionId?: number;
}) {
  const router = useRouter();
  const [me] = useMe();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const [step, setStep] = useState(initial ? 2 : 0);
  const [gameId, setGameId] = useState<number | null>(initial?.game_id ?? null);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>(() => {
    if (!initial) return [];
    const sorted = [...initial.rows].sort((a, b) => a.placement - b.placement);
    return sorted.map((r, i) => ({
      player: byId.get(r.player_id)!,
      tied: i > 0 && r.placement === sorted[i - 1].placement,
      score: r.score == null ? "" : String(r.score),
      tags: r.tags,
      team: r.team ?? "",
    }));
  });
  const [variant, setVariant] = useState<string | null>(initial?.variant ?? null);
  const [winners, setWinners] = useState<number[]>(
    () => initial?.rows.filter((r) => r.placement === 1).map((r) => r.player_id) ?? [],
  );
  const [coopResult, setCoopResult] = useState<"win" | "loss">(initial?.coop_result ?? "win");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [playedAt, setPlayedAt] = useState(
    (initial?.played_at ?? new Date().toISOString()).slice(0, 10),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const game = games.find((g) => g.id === gameId) ?? null;
  const variants = game ? gameVariants(game) : [];
  // A variant with its own role/identity split (Cribbage's 2-vs-1 Solo/Duo)
  // fully replaces the game's for sessions logged under it — so which tags
  // apply, and whether any do at all, can change as you pick the variant.
  const config = game ? effectiveConfig(game, variant) : null;
  const pool = config?.tag_pool ?? [];
  const isCoop = game?.scoring_mode === "coop-vs-game";
  const isHidden = game?.scoring_mode === "hidden-team";
  const isTeams = game?.scoring_mode === "team-vs-team";
  // Winner-only games end the moment someone wins — there is no honest 2nd, so
  // don't make anyone invent one (§5.5).
  const winnerOnly = game?.result_mode === "winner-only" && !isHidden && !isTeams;
  // Partnership-capable free-for-alls (Cribbage at four) get the same team
  // picker, but everyone defaults to playing for themselves. The chosen
  // variant can turn this on even when the parent game leaves it off.
  const canPickTeams = isTeams || !!config?.allows_teams;
  const needsTags = !!config && config.rating_dimension !== "none";
  const tagsPerPlayer = config?.rating_dimension === "multi-tag" ? config.tags_per_player : 1;
  // A nudge, never a block — house rules are the whole point.
  const outsidePlayerRange =
    !!config &&
    rows.length > 0 &&
    ((config.min_players != null && rows.length < config.min_players) ||
      (config.max_players != null && rows.length > config.max_players));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = games.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  function togglePlayer(p: Player) {
    setRows((prev) =>
      prev.some((r) => r.player.id === p.id)
        ? prev.filter((r) => r.player.id !== p.id)
        : [...prev, { player: p, tied: false, score: "", tags: [], team: "" }],
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const from = prev.findIndex((r) => r.player.id === active.id);
      const to = prev.findIndex((r) => r.player.id === over.id);
      const next = arrayMove(prev, from, to);
      next[0] = { ...next[0], tied: false }; // the top row can never be "tied with above"
      return next;
    });
  }

  /**
   * Dense placements: each untied row starts a new place, tied rows share it.
   * Winner-only games collapse to 1 for the winners and a shared 2 for the
   * rest — which is exactly what the rating engine should be told, rather than
   * a fabricated running order.
   */
  const placements = useMemo(() => {
    if (winnerOnly) return rows.map((r) => (winners.includes(r.player.id) ? 1 : 2));
    let place = 0;
    return rows.map((r, i) => {
      if (i === 0 || !r.tied) place = i + 1;
      return place;
    });
  }, [rows, winnerOnly, winners]);

  function sortByScore() {
    if (!game?.tracks_score) return;
    setRows((prev) => {
      const next = [...prev].sort((a, b) => {
        const av = a.score === "" ? -Infinity : Number(a.score);
        const bv = b.score === "" ? -Infinity : Number(b.score);
        return game.high_score_wins ? bv - av : av - bv;
      });
      return next.map((r, i) => ({
        ...r,
        tied: i > 0 && r.score !== "" && r.score === next[i - 1].score,
      }));
    });
  }

  async function submit() {
    if (!game) return;
    setBusy(true);
    setError(null);

    const payload = {
      game_id: game.id,
      variant: variants.length ? variant : null,
      played_at: new Date(`${playedAt}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
      notes: notes.trim() || null,
      difficulty: game.tracks_difficulty ? difficulty.trim() || null : null,
      coop_result: isCoop ? coopResult : null,
      logged_by: me?.id ?? null,
      participants: rows.map((r, i) => ({
        player_id: r.player.id,
        placement: isCoop ? 1 : placements[i],
        score: game.tracks_score && r.score !== "" ? Number(r.score) : null,
        team: canPickTeams ? r.team || null : isHidden ? r.tags[0] ?? null : null,
        tags: needsTags ? r.tags : null,
      })),
    };

    const res = await fetch(sessionId ? `/api/sessions/${sessionId}` : "/api/sessions", {
      method: sessionId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push(`/session/${sessionId ?? data.id}`);
    router.refresh();
  }

  /**
   * Side games (hidden roles, fixed teams) usually end "this side won" rather
   * than in a strict order — one tap beats dragging five names into place.
   */
  const sideOf = (r: Row) => (isHidden ? r.tags[0] ?? "" : r.team);
  const sides = isHidden ? pool : canPickTeams ? ["A", "B", "C"] : [];
  const sidesInPlay = sides.filter((s) => rows.some((r) => sideOf(r) === s));

  function setWinningSide(winner: string) {
    setRows((prev) => {
      const sorted = [...prev].sort(
        (a, b) => Number(sideOf(b) === winner) - Number(sideOf(a) === winner),
      );
      return sorted.map((r, i) => ({
        ...r,
        tied: i > 0 && (sideOf(sorted[i - 1]) === winner) === (sideOf(r) === winner),
      }));
    });
  }

  // -------------------------------------------------------------------------

  const canContinue = step === 0 ? !!game : step === 1 ? rows.length >= (isCoop ? 1 : 2) : true;

  return (
    <div className="pb-24">
      <Steps step={step} onJump={(s) => s < step && setStep(s)} />

      {step === 0 && (
        <section className="animate-rise">
          <input
            className="input mb-3"
            placeholder="Search your shelf…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {filtered.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setGameId(g.id);
                  setStep(1);
                }}
                className={`card card-hover flex items-center gap-3 p-3 text-left ${
                  gameId === g.id ? "ring-2 ring-grape-400" : ""
                }`}
              >
                {g.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.thumbnail}
                    alt=""
                    className="size-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xl">
                    🎲
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{g.name}</span>
                  <span className="block truncate text-[11px] text-mist-400">
                    {g.scoring_mode === "coop-vs-game" ? "Co-op" : g.scoring_mode === "ranked-ffa" ? "Free-for-all" : g.scoring_mode === "team-vs-team" ? "Teams" : "Hidden teams"}
                  </span>
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-mist-400">
                No games match. Add one from the Games tab first.
              </p>
            )}
          </div>
        </section>
      )}

      {step === 1 && game && (
        <section className="animate-rise">
          {variants.length > 0 && (
            <div className="card mb-4 p-3">
              <div className="label mb-2">Which {game.name}?</div>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const on = variant === v.name;
                  const range =
                    v.min_players && v.max_players
                      ? v.min_players === v.max_players
                        ? `${v.min_players}p`
                        : `${v.min_players}–${v.max_players}p`
                      : null;
                  return (
                    <button
                      key={v.name}
                      onClick={() => setVariant(on ? null : v.name)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                        on
                          ? "border-grape-400/60 bg-grape-500/20 text-mist-100"
                          : "border-white/10 bg-white/5 text-mist-300 hover:bg-white/10"
                      }`}
                    >
                      {v.name}
                      {range && (
                        <span className="ml-1.5 text-[11px] font-normal text-mist-400">{range}</span>
                      )}
                      {v.allows_teams && <span className="ml-1 text-[11px]">🤝</span>}
                    </button>
                  );
                })}
                <button
                  onClick={() => setVariant(null)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    variant === null
                      ? "border-white/25 bg-white/12 text-mist-100"
                      : "border-white/10 bg-white/5 text-mist-400 hover:bg-white/10"
                  }`}
                >
                  Unspecified
                </button>
              </div>
              <p className="mt-2 text-xs text-mist-400">
                Each variant keeps its own rating pool as well as counting toward {game.name}{" "}
                overall.
              </p>
            </div>
          )}

          <p className="mb-3 text-sm text-mist-400">
            Who played <span className="font-semibold text-mist-100">{game.name}</span>
            {variant ? ` · ${variant}` : ""}?
          </p>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => {
              const on = rows.some((r) => r.player.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    on
                      ? "border-grape-400/60 bg-grape-500/20 text-mist-100"
                      : "border-white/10 bg-white/5 text-mist-300 hover:bg-white/10"
                  }`}
                >
                  <Avatar emoji={p.emoji} color={p.color} size={26} />
                  {p.name}
                  {on && <span className="text-grape-300">✓</span>}
                </button>
              );
            })}
          </div>
          {rows.length > 0 && (
            <p className="mt-4 text-xs text-mist-400">
              {rows.length} at the table
              {!isCoop && rows.length < 2 && " — competitive games need at least two."}
              {outsidePlayerRange && (
                <span className="text-amber-brand">
                  {" "}
                  — {game.name} is usually {game.min_players ?? "?"}–{game.max_players ?? "?"}{" "}
                  players. Logging it anyway is fine.
                </span>
              )}
            </p>
          )}
        </section>
      )}

      {step === 2 && game && (
        <section className="animate-rise space-y-4">
          {isCoop ? (
            <div className="card p-4">
              <div className="label">Did the table win?</div>
              <div className="flex gap-2">
                {(["win", "loss"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setCoopResult(r)}
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      coopResult === r
                        ? r === "win"
                          ? "border-mint/50 bg-mint/15 text-mint"
                          : "border-rose-brand/50 bg-rose-brand/15 text-rose-brand"
                        : "border-white/10 bg-white/5 text-mist-300"
                    }`}
                  >
                    {r === "win" ? "🏅 Beat the game" : "💀 The game won"}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-mist-400">
                Co-op results are logged for streaks and difficulty stats — they never touch
                anyone&apos;s rating.
              </p>
            </div>
          ) : winnerOnly ? (
            <div className="card p-4">
              <div className="label">Who won?</div>
              <p className="mb-3 text-xs text-mist-400">
                {game.name} doesn&apos;t rank the losers, so neither do we — tap everyone who won.
              </p>
              <ul className="space-y-2">
                {rows.map((row, i) => {
                  const won = winners.includes(row.player.id);
                  return (
                    <li key={row.player.id}>
                      <div
                        className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                          won
                            ? "border-amber-brand/50 bg-amber-brand/12"
                            : "border-white/8 bg-ink-900/70"
                        }`}
                      >
                        <button
                          onClick={() =>
                            setWinners((w) =>
                              won ? w.filter((id) => id !== row.player.id) : [...w, row.player.id],
                            )
                          }
                          aria-pressed={won}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="w-7 text-center text-lg">{won ? "🏆" : "·"}</span>
                          <Avatar emoji={row.player.emoji} color={row.player.color} size={30} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {row.player.name}
                          </span>
                        </button>
                        {!!game.tracks_score && (
                          <input
                            inputMode="numeric"
                            aria-label={`${row.player.name} score`}
                            className="w-20 rounded-lg border border-white/10 bg-ink-950/70 px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-grape-400/60"
                            placeholder="score"
                            value={row.score}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((r, j) =>
                                  i === j
                                    ? { ...r, score: e.target.value.replace(/[^-\d.]/g, "") }
                                    : r,
                                ),
                              )
                            }
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {winners.length === 0 && (
                <p className="mt-3 text-xs text-amber-brand">Pick at least one winner.</p>
              )}
            </div>
          ) : (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div className="label mb-0">Finishing order</div>
                {!!game.tracks_score && (
                  <button onClick={sortByScore} className="text-xs font-semibold text-grape-300">
                    Sort by score ↓
                  </button>
                )}
              </div>
              <p className="mb-3 mt-1 text-xs text-mist-400">
                Drag to reorder. Tap 🔗 to tie a player with the one above.
              </p>

              {sidesInPlay.length > 1 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-white/4 px-3 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                    Which side won?
                  </span>
                  {sidesInPlay.map((s) => (
                    <button
                      key={s}
                      onClick={() => setWinningSide(s)}
                      className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-mist-200 hover:bg-white/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              >
                <SortableContext
                  items={rows.map((r) => r.player.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2">
                    {rows.map((row, i) => (
                      <PlacementRow
                        key={row.player.id}
                        row={row}
                        index={i}
                        place={placements[i]}
                        game={game}
                        pool={pool}
                        tagLabel={config?.tag_label ?? "Tag"}
                        tagsPerPlayer={tagsPerPlayer}
                        canPickTeams={canPickTeams}
                        onChange={(patch) =>
                          setRows((prev) =>
                            prev.map((r, j) => (i === j ? { ...r, ...patch } : r)),
                          )
                        }
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {!!game.tracks_difficulty && (
            <div className="card p-4">
              <label className="label" htmlFor="difficulty">
                Difficulty
              </label>
              <input
                id="difficulty"
                className="input"
                placeholder="e.g. 5 epidemics / Heroic / Level 3"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              />
              <p className="mt-2 text-xs text-mist-400">
                Kept on this game&apos;s own scale — never normalised across games.
              </p>
            </div>
          )}

          {isCoop && (
            <div className="card p-4">
              <div className="label">Who played</div>
              <div className="flex flex-wrap gap-2">
                {rows.map((r) => (
                  <span key={r.player.id} className="chip">
                    <Avatar emoji={r.player.emoji} color={r.player.color} size={18} />
                    {r.player.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card space-y-3 p-4">
            <div>
              <label className="label" htmlFor="played">
                Played on
              </label>
              <input
                id="played"
                type="date"
                className="input"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="notes">
                Notes <span className="normal-case tracking-normal text-ink-500">(optional)</span>
              </label>
              <textarea
                id="notes"
                className="input min-h-20 resize-y"
                placeholder="Kingmaking, table talk, who flipped the board…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-rose-brand/30 bg-rose-brand/10 px-4 py-3 text-sm text-rose-brand">
              {error}
            </p>
          )}
        </section>
      )}

      {/* Sticky action bar — the form is used standing up, at a table. */}
      <div className="pb-safe fixed inset-x-0 bottom-16 z-40 border-t border-white/8 bg-ink-950/90 px-4 py-3 backdrop-blur-xl md:bottom-0">
        <div className="mx-auto flex max-w-6xl items-center gap-3 md:pl-56">
          {step > 0 && (
            <button className="btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
              Back
            </button>
          )}
          <div className="flex-1 text-xs text-mist-400">
            {game ? game.name : "Pick a game"}
            {rows.length > 0 && ` · ${rows.length} players`}
          </div>
          {step < 2 ? (
            <button
              className="btn-primary"
              disabled={!canContinue}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          ) : (
            <button
              className="btn-primary"
              disabled={busy || (winnerOnly && winners.length === 0)}
              onClick={submit}
            >
              {busy
              ? "Saving…"
              : sessionId
                ? "Save changes"
                : "Log it 🎲"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Steps({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  const labels = ["Game", "Players", "Result"];
  return (
    <ol className="mb-4 flex items-center gap-2">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 items-center gap-2">
          <button
            onClick={() => onJump(i)}
            disabled={i >= step}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              i === step
                ? "bg-grape-500/20 text-grape-200"
                : i < step
                  ? "text-mist-300 hover:bg-white/5"
                  : "text-ink-500"
            }`}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[10px] ${
                i <= step ? "bg-grape-500 text-white" : "bg-white/8 text-mist-400"
              }`}
            >
              {i + 1}
            </span>
            {l}
          </button>
        </li>
      ))}
    </ol>
  );
}

function PlacementRow({
  row,
  index,
  place,
  game,
  pool,
  tagLabel,
  tagsPerPlayer,
  canPickTeams,
  onChange,
}: {
  row: Row;
  index: number;
  place: number;
  game: Game;
  pool: string[];
  tagLabel: string;
  tagsPerPlayer: number;
  canPickTeams: boolean;
  onChange: (patch: Partial<Row>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.player.id,
  });
  const medal = ["🥇", "🥈", "🥉"][place - 1];

  function toggleTag(tag: string) {
    const has = row.tags.includes(tag);
    if (has) onChange({ tags: row.tags.filter((t) => t !== tag) });
    else if (tagsPerPlayer === 1) onChange({ tags: [tag] });
    else if (row.tags.length < tagsPerPlayer) onChange({ tags: [...row.tags, tag] });
    else onChange({ tags: [...row.tags.slice(1), tag] });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border border-white/8 bg-ink-900/70 ${
        isDragging ? "z-10 shadow-2xl ring-1 ring-grape-400/50" : ""
      }`}
    >
      <div className="flex items-center gap-2 p-2.5">
        <button
          className="drag-handle rounded-lg px-1.5 py-2 text-mist-400 hover:bg-white/5"
          aria-label={`Reorder ${row.player.name}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="w-8 shrink-0 text-center font-display text-sm font-extrabold tabular-nums text-mist-300">
          {medal ?? place}
        </span>
        <Avatar emoji={row.player.emoji} color={row.player.color} size={30} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.player.name}</span>

        {!!game.tracks_score && (
          <input
            inputMode="numeric"
            className="w-20 rounded-lg border border-white/10 bg-ink-950/70 px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-grape-400/60"
            placeholder="score"
            value={row.score}
            onChange={(e) => onChange({ score: e.target.value.replace(/[^-\d.]/g, "") })}
          />
        )}

        {index > 0 && (
          <button
            onClick={() => onChange({ tied: !row.tied })}
            aria-pressed={row.tied}
            title="Tie with the player above"
            className={`rounded-lg px-2 py-1.5 text-sm transition ${
              row.tied ? "bg-amber-brand/20 text-amber-brand" : "text-mist-400 hover:bg-white/5"
            }`}
          >
            🔗
          </button>
        )}
      </div>

      {pool.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-white/5 px-3 py-2">
          <span className="mr-1 self-center text-[10px] font-bold uppercase tracking-wider text-ink-500">
            {tagLabel}
            {tagsPerPlayer > 1 ? ` ×${tagsPerPlayer}` : ""}
          </span>
          {pool.map((t) => {
            const on = row.tags.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  on
                    ? "bg-sky-brand/25 text-sky-brand ring-1 ring-sky-brand/40"
                    : "bg-white/5 text-mist-400 hover:bg-white/10"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}

      {canPickTeams && (
        <div className="flex items-center gap-2 border-t border-white/5 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Team</span>
          <button
            onClick={() => onChange({ team: "" })}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              row.team === ""
                ? "bg-white/12 text-mist-200 ring-1 ring-white/20"
                : "bg-white/5 text-mist-400"
            }`}
          >
            Solo
          </button>
          {["A", "B", "C"].map((t) => (
            <button
              key={t}
              onClick={() => onChange({ team: t })}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                row.team === t
                  ? "bg-grape-500/25 text-grape-200 ring-1 ring-grape-400/40"
                  : "bg-white/5 text-mist-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
