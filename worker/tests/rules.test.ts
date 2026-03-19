import { describe, expect, it } from "vitest";
import {
  assignRoles,
  buildKnowledgeMap,
  validateRoleConfig,
  type RoleId
} from "../src/rules";

describe("validateRoleConfig", () => {
  it("accepts a legal 5-player setup", () => {
    const roles: RoleId[] = ["merlin", "assassin", "evil", "good", "good"];
    const result = validateRoleConfig(5, roles);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects duplicate unique roles", () => {
    const roles: RoleId[] = ["merlin", "merlin", "assassin", "evil", "good"];
    const result = validateRoleConfig(5, roles);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Merlin");
  });

  it("rejects evil count mismatch", () => {
    const roles: RoleId[] = ["merlin", "assassin", "good", "good", "good"];
    const result = validateRoleConfig(5, roles);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Evil role count");
  });
});

describe("buildKnowledgeMap", () => {
  it("hides Mordred from Merlin and Oberon from evil", () => {
    const slots = [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bryn" },
      { id: "c", name: "Cora" },
      { id: "d", name: "Dax" },
      { id: "e", name: "Emi" }
    ];
    const assignments = {
      a: "merlin",
      b: "assassin",
      c: "mordred",
      d: "oberon",
      e: "good"
    };

    const knowledge = buildKnowledgeMap(slots, assignments);
    const merlinEntries = knowledge.a.entries.map((entry) => entry.name);
    expect(merlinEntries).toContain("Bryn");
    expect(merlinEntries).toContain("Dax");
    expect(merlinEntries).not.toContain("Cora");

    const assassinEntries = knowledge.b.entries.map((entry) => entry.name);
    expect(assassinEntries).toContain("Cora");
    expect(assassinEntries).not.toContain("Dax");
  });

  it("shows Merlin and Morgana ambiguity to Percival", () => {
    const slots = [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bryn" },
      { id: "c", name: "Cora" },
      { id: "d", name: "Dax" },
      { id: "e", name: "Emi" }
    ];
    const assignments = {
      a: "percival",
      b: "merlin",
      c: "morgana",
      d: "assassin",
      e: "good"
    };

    const knowledge = buildKnowledgeMap(slots, assignments);
    const percivalTags = knowledge.a.entries.map((entry) => entry.tag);
    expect(percivalTags).toEqual(["Merlin or Morgana", "Merlin or Morgana"]);
  });
});

describe("assignRoles", () => {
  it("assigns a role to every slot", () => {
    const roles: RoleId[] = ["merlin", "assassin", "evil", "good", "good"];
    const assignments = assignRoles(["a", "b", "c", "d", "e"], roles, () => 0.5);
    expect(Object.keys(assignments)).toHaveLength(5);
  });
});
