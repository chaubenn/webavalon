export type RoleId =
  | "merlin"
  | "assassin"
  | "percival"
  | "morgana"
  | "mordred"
  | "oberon"
  | "good"
  | "evil";

export type PlayerSlot = {
  id: string;
  name: string;
  claimed?: boolean;
};

export type LobbyState = {
  lobbyCode: string;
  lobbyName?: string;
  gameState: "lobby" | "started";
  players: PlayerSlot[];
  joinedCount: number;
  allJoined: boolean;
  ladyEnabled: boolean;
  roleConfig?: { roles: RoleId[] };
  game?: GamePublicView;
};

export type HostLobbyState = LobbyState & {
  roleConfig: { roles: RoleId[] };
};

export type PlayerState = {
  lobbyCode: string;
  lobbyName?: string;
  gameState: "lobby" | "started";
  player: { id: string; name: string };
  players: PlayerSlot[];
  role?: { id: RoleId; name: string; alignment: "good" | "evil" };
  knowledge?: { name: string; tag: string }[];
  roleConfig?: { roles: RoleId[] };
  ladyEnabled: boolean;
  game?: GamePlayerView;
};

export type MissionRecord = {
  index: number;
  leaderId: string;
  teamIds: string[];
  approved: boolean;
  success?: boolean;
  failCount?: number;
  voteSummary?: { approve: number; reject: number };
};

export type GamePublicView = {
  phase:
    | "team_select"
    | "team_vote"
    | "mission_vote"
    | "mission_result"
    | "assassination"
    | "complete";
  missionIndex: number;
  captainId: string | null;
  missionSize: number;
  currentTeamIds: string[];
  teamVote?: {
    approve?: number;
    reject?: number;
    total: number;
    pending: number;
    done: boolean;
  };
  missionVote?: {
    submitted: number;
    total: number;
    pending: number;
    done: boolean;
    failsRequired: number;
  };
  history: MissionRecord[];
  scores: { success: number; fail: number };
  teamRejections: number;
  lady: {
    enabled: boolean;
    holderId: string | null;
    lastUsedMissionIndex: number | null;
  };
  ladyUses: { missionIndex: number; viewerId: string; targetId: string }[];
  lastTeamVote?: { approve: number; reject: number; approved: boolean };
  assassination?: { targetId: string; success: boolean };
  winner?: "good" | "evil";
};

export type GamePlayerView = GamePublicView & {
  player: {
    isCaptain: boolean;
    isOnTeam: boolean;
    hasTeamVote: boolean;
    hasMissionVote: boolean;
    canFail: boolean;
    canUseLady: boolean;
    ladyAvailableFrom: number;
    ladyReveal?: { targetId: string; alignment: "good" | "evil" };
  };
};

const ENV_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://avalon-worker.benjaminchau05.workers.dev";

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const base = ENV_API_BASE;
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export async function createLobby(payload: {
  hostName: string;
  lobbyName?: string;
  playerNames: string[];
  roles: RoleId[];
  ladyEnabled: boolean;
}): Promise<{
  lobbyCode: string;
  hostSecret: string;
  hostPlayerToken: string;
  hostSlotId: string;
  lobbyName?: string;
  playerSlots: PlayerSlot[];
  roleConfig: { roles: RoleId[] };
}> {
  return fetchJson("/api/lobbies", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getLobbyState(code: string): Promise<LobbyState> {
  return fetchJson(`/api/lobbies/${code}/state`);
}

export async function getHostState(
  code: string,
  hostSecret: string
): Promise<HostLobbyState> {
  return fetchJson(`/api/lobbies/${code}/host-state`, {
    method: "POST",
    body: JSON.stringify({ hostSecret })
  });
}

export async function claimSlot(code: string, slotId: string): Promise<{
  rejoinToken: string;
  player: { id: string; name: string };
  gameState: "lobby" | "started";
}> {
  return fetchJson(`/api/lobbies/${code}/claim`, {
    method: "POST",
    body: JSON.stringify({ slotId })
  });
}

export async function rejoinLobby(
  code: string,
  token: string
): Promise<PlayerState> {
  return fetchJson(`/api/lobbies/${code}/rejoin`, {
    method: "POST",
    body: JSON.stringify({ token })
  });
}

export async function resetSlot(
  code: string,
  hostSecret: string,
  slotId: string
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/reset`, {
    method: "POST",
    body: JSON.stringify({ hostSecret, slotId })
  });
}

export async function startGame(
  code: string,
  hostSecret: string
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/start`, {
    method: "POST",
    body: JSON.stringify({ hostSecret })
  });
}

export async function selectTeam(
  code: string,
  token: string,
  teamIds: string[]
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/team`, {
    method: "POST",
    body: JSON.stringify({ token, teamIds })
  });
}

export async function submitTeamVote(
  code: string,
  token: string,
  vote: "approve" | "reject"
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/team-vote`, {
    method: "POST",
    body: JSON.stringify({ token, vote })
  });
}

export async function submitMissionVote(
  code: string,
  token: string,
  vote: "success" | "fail"
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/mission-vote`, {
    method: "POST",
    body: JSON.stringify({ token, vote })
  });
}

export async function advanceMission(
  code: string,
  hostSecret: string
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/next`, {
    method: "POST",
    body: JSON.stringify({ hostSecret })
  });
}

export async function useLady(
  code: string,
  token: string,
  targetId: string
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/lady`, {
    method: "POST",
    body: JSON.stringify({ token, targetId })
  });
}

export async function assassinate(
  code: string,
  token: string,
  targetId: string
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/assassinate`, {
    method: "POST",
    body: JSON.stringify({ token, targetId })
  });
}

export async function abortGame(
  code: string,
  hostSecret: string
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/abort`, {
    method: "POST",
    body: JSON.stringify({ hostSecret })
  });
}

export async function deleteLobby(
  code: string,
  hostSecret: string
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/delete`, {
    method: "POST",
    body: JSON.stringify({ hostSecret })
  });
}

export async function updateLobby(
  code: string,
  payload: {
    hostSecret: string;
    lobbyName?: string;
    slots: { id?: string; name: string }[];
    roles: RoleId[];
    ladyEnabled: boolean;
  }
): Promise<{ ok: true }> {
  return fetchJson(`/api/lobbies/${code}/update`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
