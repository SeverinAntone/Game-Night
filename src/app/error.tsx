"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mt-8 flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="text-5xl">🎲</div>
      <h1 className="font-display text-xl font-extrabold">Something fell off the table</h1>
      <p className="max-w-md break-words text-sm text-mist-400">{error.message}</p>
      <button className="btn-primary mt-2" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
