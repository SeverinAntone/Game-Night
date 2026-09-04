import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mt-8 flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="text-5xl">🃏</div>
      <h1 className="font-display text-xl font-extrabold">That card isn&apos;t in the deck</h1>
      <p className="text-sm text-mist-400">
        The page, game or session you were after doesn&apos;t exist any more.
      </p>
      <Link href="/" className="btn-primary mt-2">
        Back to game night
      </Link>
    </div>
  );
}
