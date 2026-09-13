import { redirect } from "next/navigation";
import { currentPlayer } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * A stable "go to my own profile" link that doesn't require knowing your own
 * id or hunting for yourself in the Players list — reuses the existing
 * player detail page (stats, edit form) entirely rather than duplicating it.
 */
export default async function ProfilePage() {
  const me = await currentPlayer();
  if (!me) redirect("/login");
  redirect(`/players/${me.id}`);
}
