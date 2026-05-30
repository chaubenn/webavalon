import { describe, expect, it } from "vitest";
import { claimSlot, resetSlot, type LobbyState } from "../src/lobby-logic";

const baseLobby = (): LobbyState => ({
  lobbyCode: "ABCDE",
  lobbyName: "Test Lobby",
  hostSecret: "host",
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  playerSlots: [
    { id: "a", name: "Alice" },
    { id: "b", name: "Bryn" }
  ],
  claimedByToken: {},
  roleConfig: { roles: ["merlin", "assassin"] },
  gameState: "lobby",
  ladyEnabled: false
});

describe("claimSlot", () => {
  it("claims an open slot", () => {
    const lobby = baseLobby();
    const result = claimSlot(lobby, "a", "token-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lobby.claimedByToken.a).toBe("token-1");
    }
  });

  it("prevents double-claim", () => {
    const lobby = baseLobby();
    claimSlot(lobby, "a", "token-1");
    const result = claimSlot(lobby, "a", "token-2");
    expect(result.ok).toBe(false);
  });
});

describe("resetSlot", () => {
  it("clears a claimed slot", () => {
    const lobby = baseLobby();
    claimSlot(lobby, "a", "token-1");
    const result = resetSlot(lobby, "a");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lobby.claimedByToken.a).toBeUndefined();
    }
  });
});
