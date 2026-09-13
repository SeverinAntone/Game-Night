import type { Role } from "./types";

/**
 * Owner > Admin > Standard > Disabled. Higher rank can manage strictly lower
 * rank; nothing can manage its own rank or higher. That single rule is what
 * produces both "admins can't demote admins" and "owners can't demote
 * owners" — a target at your own rank or above is just never manageable,
 * full stop, regardless of who's asking.
 */
const RANK: Record<Role, number> = { owner: 3, admin: 2, standard: 1, disabled: 0 };

export const ROLES: Role[] = ["owner", "admin", "standard", "disabled"];

export const isStaff = (role: Role) => role === "owner" || role === "admin";

/** Can `actor` change `target`'s role at all (regardless of what to)? */
export function canManage(actorId: number, actorRole: Role, targetId: number, targetRole: Role) {
  if (actorId === targetId) return false; // no self-service promotion or demotion
  if (!isStaff(actorRole)) return false;
  return RANK[targetRole] < RANK[actorRole];
}

/** Given canManage() already passed, is `actor` allowed to set this specific new role? */
export function canGrantRole(actorRole: Role, newRole: Role) {
  // Only an owner can create another owner — admins can promote up to admin.
  if (newRole === "owner") return actorRole === "owner";
  return true;
}

/** Disabled accounts can look at everything but can't change anything. */
export function canWrite(role: Role) {
  return role !== "disabled";
}
