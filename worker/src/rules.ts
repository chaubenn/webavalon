export type RoleId =
  | "merlin"
  | "assassin"
  | "percival"
  | "morgana"
  | "mordred"
  | "oberon"
  | "good"
  | "evil";

export type Alignment = "good" | "evil";

export type PlayerSlot = {
  id: string;
  name: string;
};

export type RoleConfig = {
  roles: RoleId[];
};

export type RoleDefinition = {
  id: RoleId;
  name: string;
  alignment: Alignment;
};

export const ROLE_DEFINITIONS: Record<RoleId, RoleDefinition> = {
  merlin: { id: "merlin", name: "Merlin", alignment: "good" },
  assassin: { id: "assassin", name: "Assassin", alignment: "evil" },
  percival: { id: "percival", name: "Percival", alignment: "good" },
  morgana: { id: "morgana", name: "Morgana", alignment: "evil" },
  mordred: { id: "mordred", name: "Mordred", alignment: "evil" },
  oberon: { id: "oberon", name: "Oberon", alignment: "evil" },
  good: { id: "good", name: "Loyal Servant", alignment: "good" },
  evil: { id: "evil", name: "Minion of Mordred", alignment: "evil" }
};

const UNIQUE_ROLES: RoleId[] = [
  "merlin",
  "assassin",
  "percival",
  "morgana",
  "mordred",
  "oberon"
];

const EVIL_COUNT_BY_PLAYERS: Record<number, number> = {
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 4
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
};

export function roleAlignment(roleId: RoleId): Alignment {
  return ROLE_DEFINITIONS[roleId].alignment;
}

export function requiredEvilCount(playerCount: number): number | null {
  return EVIL_COUNT_BY_PLAYERS[playerCount] ?? null;
}

export function validateRoleConfig(
  playerCount: number,
  roles: RoleId[]
): ValidationResult {
  const errors: string[] = [];
  const requiredEvil = requiredEvilCount(playerCount);

  if (requiredEvil === null) {
    errors.push("Player count must be between 5 and 10.");
  }

  if (roles.length !== playerCount) {
    errors.push("Role count must match player count.");
  }

  const uniqueCounts = new Map<RoleId, number>();
  for (const role of roles) {
    uniqueCounts.set(role, (uniqueCounts.get(role) ?? 0) + 1);
  }

  for (const role of UNIQUE_ROLES) {
    if ((uniqueCounts.get(role) ?? 0) > 1) {
      errors.push(`Role ${ROLE_DEFINITIONS[role].name} cannot be duplicated.`);
    }
  }

  const hasMerlin = (uniqueCounts.get("merlin") ?? 0) === 1;
  const hasAssassin = (uniqueCounts.get("assassin") ?? 0) === 1;

  if (!hasMerlin) {
    errors.push("Merlin is required.");
  }
  if (!hasAssassin) {
    errors.push("Assassin is required.");
  }
  if ((uniqueCounts.get("percival") ?? 0) === 1 && !hasMerlin) {
    errors.push("Percival requires Merlin.");
  }

  const evilCount = roles.filter((role) => roleAlignment(role) === "evil").length;
  if (requiredEvil !== null && evilCount !== requiredEvil) {
    errors.push(
      `Evil role count must be ${requiredEvil} for ${playerCount} players.`
    );
  }

  return { ok: errors.length === 0, errors };
}

export type RoleAssignments = Record<string, RoleId>;

export function assignRoles(
  slotIds: string[],
  roles: RoleId[],
  rng: () => number = Math.random
): RoleAssignments {
  if (slotIds.length !== roles.length) {
    throw new Error("Slot count must match role count.");
  }

  const shuffledRoles = shuffleArray([...roles], rng);
  const assignments: RoleAssignments = {};
  slotIds.forEach((slotId, index) => {
    assignments[slotId] = shuffledRoles[index];
  });
  return assignments;
}

export type KnowledgeEntry = {
  slotId: string;
  name: string;
  tag: string;
};

export type PlayerKnowledge = {
  roleId: RoleId;
  alignment: Alignment;
  entries: KnowledgeEntry[];
};

export function buildKnowledgeMap(
  slots: PlayerSlot[],
  assignments: RoleAssignments
): Record<string, PlayerKnowledge> {
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const roleBySlot = new Map(Object.entries(assignments));

  const evilSlots = slots.filter(
    (slot) => roleAlignment(roleBySlot.get(slot.id) as RoleId) === "evil"
  );
  const evilWithoutOberon = evilSlots.filter(
    (slot) => roleBySlot.get(slot.id) !== "oberon"
  );

  const merlinSlot = slots.find(
    (slot) => roleBySlot.get(slot.id) === "merlin"
  );
  const morganaSlot = slots.find(
    (slot) => roleBySlot.get(slot.id) === "morgana"
  );

  const knowledgeMap: Record<string, PlayerKnowledge> = {};

  for (const slot of slots) {
    const roleId = roleBySlot.get(slot.id) as RoleId;
    const alignment = roleAlignment(roleId);
    const entries: KnowledgeEntry[] = [];

    if (roleId === "merlin") {
      for (const evilSlot of evilSlots) {
        if (roleBySlot.get(evilSlot.id) === "mordred") {
          continue;
        }
        entries.push({
          slotId: evilSlot.id,
          name: evilSlot.name,
          tag: "Evil"
        });
      }
    } else if (roleId === "percival") {
      if (merlinSlot) {
        entries.push({
          slotId: merlinSlot.id,
          name: merlinSlot.name,
          tag: morganaSlot ? "Merlin or Morgana" : "Merlin"
        });
      }
      if (morganaSlot) {
        entries.push({
          slotId: morganaSlot.id,
          name: morganaSlot.name,
          tag: "Merlin or Morgana"
        });
      }
    } else if (alignment === "evil" && roleId !== "oberon") {
      for (const evilSlot of evilWithoutOberon) {
        if (evilSlot.id === slot.id) {
          continue;
        }
        const evilRoleId = roleBySlot.get(evilSlot.id) as RoleId;
        entries.push({
          slotId: evilSlot.id,
          name: evilSlot.name,
          tag: ROLE_DEFINITIONS[evilRoleId].name
        });
      }
    }

    knowledgeMap[slot.id] = {
      roleId,
      alignment,
      entries
    };
  }

  return knowledgeMap;
}

function shuffleArray<T>(array: T[], rng: () => number): T[] {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
