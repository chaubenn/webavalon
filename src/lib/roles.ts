export type RoleId =
  | "merlin"
  | "assassin"
  | "percival"
  | "morgana"
  | "mordred"
  | "oberon"
  | "good"
  | "evil";

export type RoleSummary = {
  id: RoleId;
  name: string;
  alignment: "good" | "evil";
};

export const ROLE_DEFINITIONS: Record<RoleId, RoleSummary> = {
  merlin: { id: "merlin", name: "Merlin", alignment: "good" },
  assassin: { id: "assassin", name: "Assassin", alignment: "evil" },
  percival: { id: "percival", name: "Percival", alignment: "good" },
  morgana: { id: "morgana", name: "Morgana", alignment: "evil" },
  mordred: { id: "mordred", name: "Mordred", alignment: "evil" },
  oberon: { id: "oberon", name: "Oberon", alignment: "evil" },
  good: { id: "good", name: "Loyal Servant", alignment: "good" },
  evil: { id: "evil", name: "Minion of Mordred", alignment: "evil" }
};

const EVIL_COUNT_BY_PLAYERS: Record<number, number> = {
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 4
};

export function requiredEvilCount(playerCount: number): number | null {
  return EVIL_COUNT_BY_PLAYERS[playerCount] ?? null;
}

export function buildRoleConfig(
  playerCount: number,
  options: {
    percival: boolean;
    morgana: boolean;
    mordred: boolean;
    oberon: boolean;
  }
): { roles: RoleId[]; errors: string[] } {
  const errors: string[] = [];
  const requiredEvil = requiredEvilCount(playerCount);

  if (!requiredEvil) {
    errors.push("Player count must be between 5 and 10.");
  }

  const roles: RoleId[] = ["merlin", "assassin"];
  if (options.percival) roles.push("percival");
  if (options.morgana) roles.push("morgana");
  if (options.mordred) roles.push("mordred");
  if (options.oberon) roles.push("oberon");

  const evilCount = roles.filter(
    (role) => ROLE_DEFINITIONS[role].alignment === "evil"
  ).length;

  if (requiredEvil !== null && evilCount > requiredEvil) {
    errors.push("Too many evil roles selected for this player count.");
  }

  const remainingSlots = playerCount - roles.length;
  if (remainingSlots < 0) {
    errors.push("Too many special roles for this player count.");
  }

  if (requiredEvil !== null) {
    const remainingEvil = requiredEvil - evilCount;
    if (remainingEvil > 0) {
      roles.push(
        ...Array.from({ length: remainingEvil }, () => "evil" as RoleId)
      );
    }
  }

  while (roles.length < playerCount) {
    roles.push("good");
  }

  if (roles.length !== playerCount) {
    errors.push("Role count does not match player count.");
  }

  return { roles, errors };
}
