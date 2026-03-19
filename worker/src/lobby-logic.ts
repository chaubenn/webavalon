import {
  type Alignment,
  type PlayerSlot,
  type RoleAssignments,
  type RoleConfig
} from "./rules";

export type GamePhase =
  | "team_select"
  | "team_vote"
  | "mission_vote"
  | "mission_result"
  | "assassination"
  | "complete";

export type MissionRecord = {
  index: number;
  leaderId: string;
  teamIds: string[];
  approved: boolean;
  success?: boolean;
  failCount?: number;
  voteSummary?: { approve: number; reject: number };
};

export type GameState = {
  phase: GamePhase;
  missionIndex: number;
  captainIndex: number;
  currentTeam: string[];
  teamVotes: Record<string, "approve" | "reject">;
  missionVotes: Record<string, "success" | "fail">;
  history: MissionRecord[];
  scores: { success: number; fail: number };
  teamRejections: number;
  lastTeamVote?: { approve: number; reject: number; approved: boolean };
  lady: {
    enabled: boolean;
    holderId: string | null;
    lastUsedMissionIndex: number | null;
    revealed?: { targetId: string; alignment: Alignment; viewerId: string };
    uses: { missionIndex: number; viewerId: string; targetId: string }[];
  };
  assassination?: {
    targetId: string;
    success: boolean;
  };
  winner?: Alignment;
};

export type LobbyState = {
  lobbyCode: string;
  lobbyName?: string;
  hostSecret: string;
  createdAt: string;
  expiresAt: string;
  playerSlots: PlayerSlot[];
  claimedByToken: Record<string, string>;
  roleConfig: RoleConfig;
  gameState: "lobby" | "started";
  assignments?: RoleAssignments;
  ladyEnabled: boolean;
  game?: GameState;
};

export type ClaimResult =
  | {
      ok: true;
      lobby: LobbyState;
      token: string;
      slot: PlayerSlot;
    }
  | { ok: false; error: string };

export type ResetResult =
  | { ok: true; lobby: LobbyState }
  | { ok: false; error: string };

export function claimSlot(
  lobby: LobbyState,
  slotId: string,
  token: string
): ClaimResult {
  if (lobby.gameState === "started") {
    return { ok: false, error: "Game already started." };
  }

  const slot = lobby.playerSlots.find((candidate) => candidate.id === slotId);
  if (!slot) {
    return { ok: false, error: "Player slot not found." };
  }

  if (lobby.claimedByToken[slotId]) {
    return { ok: false, error: "Slot already claimed." };
  }

  lobby.claimedByToken[slotId] = token;
  return { ok: true, lobby, token, slot };
}

export function resetSlot(lobby: LobbyState, slotId: string): ResetResult {
  if (!lobby.claimedByToken[slotId]) {
    return { ok: false, error: "Slot already unclaimed." };
  }

  delete lobby.claimedByToken[slotId];
  return { ok: true, lobby };
}
