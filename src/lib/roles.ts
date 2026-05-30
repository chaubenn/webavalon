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

export type RolePresentation = {
  cardSrc: string;
  iconSrc?: string;
  accent: "good" | "evil";
  flavorText: string;
};

// Portrait art lives in /public/roles/{id}-card.webp. Only assets that exist
// today render; the rest fall back to a card back until generated.
export const ROLE_PRESENTATION: Record<RoleId, RolePresentation> = {
  merlin: {
    cardSrc: "/roles/merlin-card.webp",
    iconSrc: "/roles/merlin-icon.webp",
    accent: "good",
    flavorText: "Keeper of Camelot's hidden truth"
  },
  percival: {
    cardSrc: "/roles/percival-card.webp",
    iconSrc: "/roles/percival-icon.webp",
    accent: "good",
    flavorText: "Knight who sees what others cannot"
  },
  good: {
    cardSrc: "/roles/good-card.webp",
    iconSrc: "/roles/good-icon.webp",
    accent: "good",
    flavorText: "Loyal servant of Arthur"
  },
  assassin: {
    cardSrc: "/roles/assassin-card.webp",
    iconSrc: "/roles/assassin-icon.webp",
    accent: "evil",
    flavorText: "Blade that waits for Merlin's end"
  },
  morgana: {
    cardSrc: "/roles/morgana-card.webp",
    iconSrc: "/roles/morgana-icon.webp",
    accent: "evil",
    flavorText: "She who wears the wizard's mask"
  },
  mordred: {
    cardSrc: "/roles/mordred-card.webp",
    iconSrc: "/roles/mordred-icon.webp",
    accent: "evil",
    flavorText: "Hidden even from Merlin's sight"
  },
  oberon: {
    cardSrc: "/roles/oberon-card.webp",
    iconSrc: "/roles/oberon-icon.webp",
    accent: "evil",
    flavorText: "Alone in the court of shadows"
  },
  evil: {
    cardSrc: "/roles/evil-card.webp",
    iconSrc: "/roles/evil-icon.webp",
    accent: "evil",
    flavorText: "Minion in Mordred's service"
  }
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
