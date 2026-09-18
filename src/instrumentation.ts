/**
 * Next.js calls `register()` once per server start (native support since
 * Next 15, no experimental flag needed). This is the one safe place to run
 * a startup migration that itself needs the database: by the time this
 * fires the module graph is fully loaded, so `getDb()` in recompute.ts can
 * open the connection normally instead of recursing (see the long comment
 * on `ensureRatingFormulaCurrent` for why it can't live in db.ts itself).
 *
 * This is also exactly the moment Watchtower restarts the container with a
 * newly-deployed image, which is what makes a rating-formula change take
 * effect on the whole database without a migration step in the deploy.
 */
export async function register() {
  // Next also compiles this file for the edge runtime, which can't resolve
  // better-sqlite3's native (fs/path-using) dependencies at all. The
  // `NEXT_RUNTIME === "nodejs"` guard around the import — not an early
  // return before it — is what Next's build recognizes to skip bundling the
  // Node-only branch for that edge compilation pass.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureRatingFormulaCurrent } = await import("./lib/recompute");
    await ensureRatingFormulaCurrent();
  }
}
