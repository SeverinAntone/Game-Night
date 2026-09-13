import { LoginOrSignup } from "@/components/LoginOrSignup";
import { SetupForm } from "@/components/SetupForm";
import { playerCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const needsSetup = playerCount() === 0;
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <div className="mb-6 text-center">
        <div className="font-display text-2xl font-extrabold tracking-tight">
          <span className="text-grape-400">🎲</span> Game Night
        </div>
        <p className="mt-1 text-sm text-mist-400">
          {needsSetup ? "Let's get this set up." : "Sign in to continue."}
        </p>
      </div>
      {needsSetup ? (
        <SetupForm />
      ) : (
        <LoginOrSignup next={sp.next && sp.next.startsWith("/") ? sp.next : "/"} />
      )}
    </div>
  );
}
