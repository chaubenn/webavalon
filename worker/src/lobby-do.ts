import {
  assignRoles,
  buildKnowledgeMap,
  roleAlignment,
  validateRoleConfig,
  type Alignment,
  type PlayerSlot,
  type RoleConfig,
  type RoleId
} from "./rules";
import { getFailsRequired, getMissionTeamSize } from "./game";
import {
  claimSlot,
  resetSlot,
  type GameState,
  type LobbyState,
  type MissionRecord
} from "./lobby-logic";

type PublicPlayerSlot = {
  id: string;
  name: string;
  claimed: boolean;
};

type PublicLobbyState = {
  lobbyCode: string;
  lobbyName?: string;
  gameState: "lobby" | "started";
  players: PublicPlayerSlot[];
  joinedCount: number;
  allJoined: boolean;
  ladyEnabled: boolean;
  roleConfig: RoleConfig;
  game?: GamePublicView;
};

type HostLobbyState = PublicLobbyState & {
  roleConfig: RoleConfig;
};

type PlayerState = {
  lobbyCode: string;
  lobbyName?: string;
  gameState: "lobby" | "started";
  player: { id: string; name: string };
  players: PublicPlayerSlot[];
  role?: { id: RoleId; name: string; alignment: "good" | "evil" };
  knowledge?: { name: string; tag: string }[];
  roleConfig: RoleConfig;
  ladyEnabled: boolean;
  game?: GamePlayerView;
};

type GamePublicView = {
  phase: GameState["phase"];
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
  winner?: Alignment;
};

type GamePlayerView = GamePublicView & {
  player: {
    isCaptain: boolean;
    isOnTeam: boolean;
    hasTeamVote: boolean;
    hasMissionVote: boolean;
    canFail: boolean;
    canUseLady: boolean;
    ladyAvailableFrom: number;
    ladyReveal?: { targetId: string; alignment: Alignment };
  };
};

type ConnectionInfo = {
  socket: WebSocket;
  kind: "public" | "host" | "player";
  slotId?: string;
};

type ClientMessage =
  | { type: "join_public" }
  | { type: "join_host"; hostSecret: string }
  | { type: "join_player"; rejoinToken: string }
  | { type: "ping" };

const LOBBY_STORAGE_KEY = "lobby";

export class LobbyDurableObject implements DurableObject {
  private state: DurableObjectState;
  private connections = new Map<string, ConnectionInfo>();
  private cachedLobby: LobbyState | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("upgrade") === "websocket") {
      return this.handleWebSocket();
    }

    if (url.pathname === "/init" && request.method === "POST") {
      return this.handleInit(request);
    }

    const lobby = await this.loadLobby();
    if (!lobby) {
      return this.json({ error: "Lobby not found." }, 404);
    }

    if (this.isExpired(lobby)) {
      await this.expireLobby();
      return this.json({ error: "Lobby expired." }, 410);
    }

    if (url.pathname === "/state" && request.method === "GET") {
      return this.json(this.buildPublicState(lobby));
    }

    if (url.pathname === "/host-state" && request.method === "POST") {
      const body = await request.json<{
        hostSecret: string;
      }>();
      if (body.hostSecret !== lobby.hostSecret) {
        return this.json({ error: "Unauthorized." }, 403);
      }
      return this.json(this.buildHostState(lobby));
    }

    if (url.pathname === "/claim" && request.method === "POST") {
      const body = await request.json<{ slotId: string }>();
      return this.handleClaim(lobby, body.slotId);
    }

    if (url.pathname === "/rejoin" && request.method === "POST") {
      const body = await request.json<{ token: string }>();
      return this.handleRejoin(lobby, body.token);
    }

    if (url.pathname === "/reset" && request.method === "POST") {
      const body = await request.json<{
        hostSecret: string;
        slotId: string;
      }>();
      if (body.hostSecret !== lobby.hostSecret) {
        return this.json({ error: "Unauthorized." }, 403);
      }
      return this.handleReset(lobby, body.slotId);
    }

    if (url.pathname === "/start" && request.method === "POST") {
      const body = await request.json<{ hostSecret: string }>();
      if (body.hostSecret !== lobby.hostSecret) {
        return this.json({ error: "Unauthorized." }, 403);
      }
      return this.handleStart(lobby);
    }

    if (url.pathname === "/team" && request.method === "POST") {
      const body = await request.json<{ token: string; teamIds: string[] }>();
      return this.handleTeamSelect(lobby, body.token, body.teamIds);
    }

    if (url.pathname === "/team-vote" && request.method === "POST") {
      const body = await request.json<{
        token: string;
        vote: "approve" | "reject";
      }>();
      return this.handleTeamVote(lobby, body.token, body.vote);
    }

    if (url.pathname === "/mission-vote" && request.method === "POST") {
      const body = await request.json<{
        token: string;
        vote: "success" | "fail";
      }>();
      return this.handleMissionVote(lobby, body.token, body.vote);
    }

    if (url.pathname === "/next" && request.method === "POST") {
      const body = await request.json<{ hostSecret: string }>();
      if (body.hostSecret !== lobby.hostSecret) {
        return this.json({ error: "Unauthorized." }, 403);
      }
      return this.handleNextMission(lobby);
    }

    if (url.pathname === "/lady" && request.method === "POST") {
      const body = await request.json<{ token: string; targetId: string }>();
      return this.handleLady(lobby, body.token, body.targetId);
    }

    if (url.pathname === "/assassinate" && request.method === "POST") {
      const body = await request.json<{ token: string; targetId: string }>();
      return this.handleAssassinate(lobby, body.token, body.targetId);
    }

    if (url.pathname === "/abort" && request.method === "POST") {
      const body = await request.json<{ hostSecret: string }>();
      if (body.hostSecret !== lobby.hostSecret) {
        return this.json({ error: "Unauthorized." }, 403);
      }
      return this.handleAbort(lobby);
    }

    if (url.pathname === "/delete" && request.method === "POST") {
      const body = await request.json<{ hostSecret: string }>();
      if (body.hostSecret !== lobby.hostSecret) {
        return this.json({ error: "Unauthorized." }, 403);
      }
      return this.handleDelete(lobby);
    }

    if (url.pathname === "/update" && request.method === "POST") {
      const body = await request.json<{
        hostSecret: string;
        lobbyName?: string;
        slots: { id?: string; name: string }[];
        roles: RoleId[];
        ladyEnabled: boolean;
      }>();
      if (body.hostSecret !== lobby.hostSecret) {
        return this.json({ error: "Unauthorized." }, 403);
      }
      return this.handleUpdateLobby(lobby, body);
    }

    return this.json({ error: "Not found." }, 404);
  }

  private async handleInit(request: Request): Promise<Response> {
    const existing = await this.loadLobby();
    if (existing) {
      return this.json({ error: "Lobby already exists." }, 409);
    }

    const body = await request.json<LobbyState>();
    await this.saveLobby(body);
    return this.json({ ok: true });
  }

  private async handleClaim(
    lobby: LobbyState,
    slotId: string
  ): Promise<Response> {
    const token = crypto.randomUUID();
    const result = claimSlot(lobby, slotId, token);
    if (!result.ok) {
      const status =
        result.error === "Player slot not found." ? 404 : 409;
      return this.json({ error: result.error }, status);
    }

    await this.saveLobby(result.lobby);
    this.broadcastPublicState(result.lobby);

    return this.json({
      rejoinToken: result.token,
      player: { id: result.slot.id, name: result.slot.name },
      gameState: result.lobby.gameState
    });
  }

  private async handleRejoin(
    lobby: LobbyState,
    token: string
  ): Promise<Response> {
    const slot = this.slotFromToken(lobby, token);
    if (!slot) {
      return this.json({ error: "Session not found." }, 404);
    }

    return this.json(this.buildPlayerState(lobby, slot.id));
  }

  private async handleReset(
    lobby: LobbyState,
    slotId: string
  ): Promise<Response> {
    const result = resetSlot(lobby, slotId);
    if (!result.ok) {
      return this.json({ error: result.error }, 409);
    }

    await this.saveLobby(result.lobby);
    this.broadcastPublicState(result.lobby);
    this.invalidatePlayerSession(slotId);

    return this.json({ ok: true });
  }

  private async handleStart(lobby: LobbyState): Promise<Response> {
    if (lobby.gameState === "started") {
      return this.json({ error: "Game already started." }, 409);
    }

    const allJoined =
      Object.keys(lobby.claimedByToken).length === lobby.playerSlots.length;
    if (!allJoined) {
      return this.json({ error: "All players must join first." }, 409);
    }

    const assignments = assignRoles(
      lobby.playerSlots.map((slot) => slot.id),
      lobby.roleConfig.roles
    );

    const playerCount = lobby.playerSlots.length;
    const captainIndex = Math.floor(Math.random() * playerCount);
    const ladyHolderId = lobby.ladyEnabled
      ? lobby.playerSlots
          .map((slot, index) => ({ id: slot.id, index }))
          .filter((slot) => slot.index !== captainIndex)
          .map((slot) => slot.id)[
          Math.floor(Math.random() * Math.max(playerCount - 1, 1))
        ] ?? null
      : null;

    lobby.gameState = "started";
    lobby.assignments = assignments;
    lobby.game = {
      phase: "team_select",
      missionIndex: 0,
      captainIndex,
      currentTeam: [],
      teamVotes: {},
      missionVotes: {},
      history: [],
      scores: { success: 0, fail: 0 },
      teamRejections: 0,
      lady: {
        enabled: lobby.ladyEnabled,
        holderId: ladyHolderId,
        lastUsedMissionIndex: null,
        uses: []
      },
      assassination: undefined,
      winner: undefined
    };
    await this.saveLobby(lobby);

    this.broadcastPublicState(lobby);
    this.broadcastPlayerStates(lobby);

    return this.json({ ok: true });
  }

  private async handleTeamSelect(
    lobby: LobbyState,
    token: string,
    teamIds: string[]
  ): Promise<Response> {
    if (!lobby.game || lobby.gameState !== "started") {
      return this.json({ error: "Game not started." }, 409);
    }
    if (lobby.game.phase !== "team_select") {
      return this.json({ error: "Not accepting team selections." }, 409);
    }

    const slot = this.slotFromToken(lobby, token);
    if (!slot) {
      return this.json({ error: "Session invalid." }, 403);
    }

    const captainId = lobby.playerSlots[lobby.game.captainIndex]?.id;
    if (!captainId || slot.id !== captainId) {
      return this.json({ error: "Only the captain can set the team." }, 403);
    }

    const uniqueTeam = Array.from(new Set(teamIds));
    const missionSize = getMissionTeamSize(
      lobby.playerSlots.length,
      lobby.game.missionIndex
    );
    if (!missionSize) {
      return this.json({ error: "Invalid mission setup." }, 400);
    }
    if (uniqueTeam.length !== missionSize) {
      return this.json({ error: `Team must have ${missionSize} players.` }, 400);
    }

    const allSlotIds = new Set(lobby.playerSlots.map((player) => player.id));
    if (uniqueTeam.some((id) => !allSlotIds.has(id))) {
      return this.json({ error: "Invalid team member." }, 400);
    }

    lobby.game.currentTeam = uniqueTeam;
    lobby.game.teamVotes = {};
    lobby.game.missionVotes = {};
    lobby.game.phase = "team_vote";
    lobby.game.lastTeamVote = undefined;
    await this.saveLobby(lobby);

    this.broadcastPublicState(lobby);
    this.broadcastPlayerStates(lobby);

    return this.json({ ok: true });
  }

  private async handleTeamVote(
    lobby: LobbyState,
    token: string,
    vote: "approve" | "reject"
  ): Promise<Response> {
    if (!lobby.game || lobby.gameState !== "started") {
      return this.json({ error: "Game not started." }, 409);
    }
    if (lobby.game.phase !== "team_vote") {
      return this.json({ error: "Not accepting team votes." }, 409);
    }

    const slot = this.slotFromToken(lobby, token);
    if (!slot) {
      return this.json({ error: "Session invalid." }, 403);
    }

    if (lobby.game.teamVotes[slot.id]) {
      return this.json({ error: "Vote already submitted." }, 409);
    }

    lobby.game.teamVotes[slot.id] = vote;

    const totalPlayers = lobby.playerSlots.length;
    const votes = Object.values(lobby.game.teamVotes);
    if (votes.length === totalPlayers) {
      const approve = votes.filter((value) => value === "approve").length;
      const reject = votes.filter((value) => value === "reject").length;
      const approved = approve > reject;
      lobby.game.lastTeamVote = { approve, reject, approved };
      if (approved) {
        lobby.game.phase = "mission_vote";
        lobby.game.missionVotes = {};
        lobby.game.teamRejections = 0;
      } else {
        lobby.game.teamRejections += 1;
        if (lobby.game.teamRejections >= 5) {
          lobby.game.winner = "evil";
          lobby.game.phase = "complete";
        } else {
          lobby.game.phase = "team_select";
          lobby.game.currentTeam = [];
          lobby.game.teamVotes = {};
          lobby.game.captainIndex = this.nextCaptainIndex(lobby);
        }
      }
    }

    await this.saveLobby(lobby);
    this.broadcastPublicState(lobby);
    this.broadcastPlayerStates(lobby);

    return this.json({ ok: true });
  }

  private async handleMissionVote(
    lobby: LobbyState,
    token: string,
    vote: "success" | "fail"
  ): Promise<Response> {
    if (!lobby.game || lobby.gameState !== "started") {
      return this.json({ error: "Game not started." }, 409);
    }
    if (lobby.game.phase !== "mission_vote") {
      return this.json({ error: "Not accepting mission votes." }, 409);
    }

    const slot = this.slotFromToken(lobby, token);
    if (!slot) {
      return this.json({ error: "Session invalid." }, 403);
    }

    if (!lobby.game.currentTeam.includes(slot.id)) {
      return this.json({ error: "You are not on this mission." }, 403);
    }

    const roleId = lobby.assignments?.[slot.id];
    if (roleId && roleAlignment(roleId) === "good" && vote === "fail") {
      return this.json({ error: "Good players cannot fail missions." }, 403);
    }

    if (lobby.game.missionVotes[slot.id]) {
      return this.json({ error: "Vote already submitted." }, 409);
    }

    lobby.game.missionVotes[slot.id] = vote;

    const totalTeam = lobby.game.currentTeam.length;
    const votes = Object.values(lobby.game.missionVotes);
    if (votes.length === totalTeam) {
      const failCount = votes.filter((value) => value === "fail").length;
      const failsRequired = getFailsRequired(
        lobby.playerSlots.length,
        lobby.game.missionIndex
      );
      const success = failCount < failsRequired;

      const leaderId = lobby.playerSlots[lobby.game.captainIndex]?.id ?? "";
      lobby.game.history.push({
        index: lobby.game.missionIndex,
        leaderId,
        teamIds: lobby.game.currentTeam,
        approved: true,
        success,
        failCount,
        voteSummary: lobby.game.lastTeamVote
      });

      if (success) {
        lobby.game.scores.success += 1;
      } else {
        lobby.game.scores.fail += 1;
      }

      if (lobby.game.scores.fail >= 3) {
        lobby.game.winner = "evil";
        lobby.game.phase = "complete";
      } else if (lobby.game.scores.success >= 3) {
        lobby.game.phase = "assassination";
      } else {
        this.advanceToNextMission(lobby);
      }
    }

    await this.saveLobby(lobby);
    this.broadcastPublicState(lobby);
    this.broadcastPlayerStates(lobby);

    return this.json({ ok: true });
  }

  private async handleNextMission(lobby: LobbyState): Promise<Response> {
    if (!lobby.game || lobby.gameState !== "started") {
      return this.json({ error: "Game not started." }, 409);
    }
    if (lobby.game.phase !== "mission_result") {
      return this.json({ error: "Cannot advance yet." }, 409);
    }

    this.advanceToNextMission(lobby);

    await this.saveLobby(lobby);
    this.broadcastPublicState(lobby);
    this.broadcastPlayerStates(lobby);

    return this.json({ ok: true });
  }

  private advanceToNextMission(lobby: LobbyState): void {
    if (!lobby.game) {
      return;
    }
    lobby.game.missionIndex += 1;
    lobby.game.captainIndex = this.nextCaptainIndex(lobby);
    lobby.game.currentTeam = [];
    lobby.game.teamVotes = {};
    lobby.game.missionVotes = {};
    lobby.game.lastTeamVote = undefined;
    lobby.game.teamRejections = 0;
    lobby.game.lady.revealed = undefined;
    lobby.game.phase = "team_select";
  }

  private async handleLady(
    lobby: LobbyState,
    token: string,
    targetId: string
  ): Promise<Response> {
    if (!lobby.game || lobby.gameState !== "started") {
      return this.json({ error: "Game not started." }, 409);
    }
    if (
      !lobby.game.lady.enabled ||
      lobby.game.phase === "complete" ||
      lobby.game.phase === "assassination"
    ) {
      return this.json({ error: "Lady of the Lake not available." }, 409);
    }

    const slot = this.slotFromToken(lobby, token);
    if (!slot) {
      return this.json({ error: "Session invalid." }, 403);
    }

    if (slot.id !== lobby.game.lady.holderId) {
      return this.json({ error: "Only the Lady holder can act." }, 403);
    }

    const ladyAvailableFrom = 1;
    if (lobby.game.missionIndex < ladyAvailableFrom) {
      return this.json(
        { error: "Lady of the Lake is not available yet." },
        409
      );
    }

    if (
      lobby.game.lady.lastUsedMissionIndex !== null &&
      lobby.game.missionIndex <= lobby.game.lady.lastUsedMissionIndex
    ) {
      return this.json(
        { error: "Lady of the Lake can only be used once per round." },
        409
      );
    }

    if (targetId === slot.id) {
      return this.json({ error: "Choose another player." }, 400);
    }

    const target = lobby.playerSlots.find((player) => player.id === targetId);
    if (!target) {
      return this.json({ error: "Invalid target." }, 400);
    }

    const roleId = lobby.assignments?.[targetId];
    const alignment = roleId ? roleAlignment(roleId) : "good";

    lobby.game.lady.revealed = { targetId, alignment, viewerId: slot.id };
    lobby.game.lady.holderId = targetId;
    lobby.game.lady.lastUsedMissionIndex = lobby.game.missionIndex;
    if (!gameLadyUses(lobby.game.lady)) {
      lobby.game.lady.uses = [];
    }
    const useRecord = {
      missionIndex: lobby.game.missionIndex,
      viewerId: slot.id,
      targetId
    };
    const existingUseIndex = lobby.game.lady.uses.findIndex(
      (entry) =>
        entry.missionIndex === useRecord.missionIndex &&
        entry.viewerId === useRecord.viewerId
    );
    if (existingUseIndex >= 0) {
      lobby.game.lady.uses[existingUseIndex] = useRecord;
    } else {
      lobby.game.lady.uses.push(useRecord);
    }

    await this.saveLobby(lobby);
    this.broadcastPublicState(lobby);
    this.broadcastPlayerStates(lobby);

    return this.json({ ok: true });
  }

  private async handleAssassinate(
    lobby: LobbyState,
    token: string,
    targetId: string
  ): Promise<Response> {
    if (!lobby.game || lobby.gameState !== "started") {
      return this.json({ error: "Game not started." }, 409);
    }
    if (lobby.game.phase !== "assassination") {
      return this.json({ error: "Assassination not available." }, 409);
    }

    const slot = this.slotFromToken(lobby, token);
    if (!slot) {
      return this.json({ error: "Session invalid." }, 403);
    }

    const assassinSlotId = Object.entries(lobby.assignments ?? {}).find(
      ([, role]) => role === "assassin"
    )?.[0];

    if (!assassinSlotId || slot.id !== assassinSlotId) {
      return this.json({ error: "Only the assassin can act." }, 403);
    }

    const target = lobby.playerSlots.find((player) => player.id === targetId);
    if (!target) {
      return this.json({ error: "Invalid target." }, 400);
    }

    const targetRole = lobby.assignments?.[targetId];
    const success = targetRole === "merlin";
    lobby.game.assassination = { targetId, success };
    lobby.game.winner = success ? "evil" : "good";
    lobby.game.phase = "complete";

    await this.saveLobby(lobby);
    this.broadcastPublicState(lobby);
    this.broadcastPlayerStates(lobby);

    return this.json({ ok: true });
  }

  private async handleAbort(lobby: LobbyState): Promise<Response> {
    if (lobby.gameState !== "started") {
      return this.json({ error: "Game is not running." }, 409);
    }

    lobby.gameState = "lobby";
    lobby.assignments = undefined;
    lobby.game = undefined;
    await this.saveLobby(lobby);

    this.broadcastPublicState(lobby);
    this.broadcastPlayerStates(lobby);
    this.broadcastEvent({ type: "game_aborted" });

    return this.json({ ok: true });
  }

  private async handleDelete(lobby: LobbyState): Promise<Response> {
    this.broadcastEvent({ type: "lobby_deleted" });
    for (const connection of this.connections.values()) {
      try {
        connection.socket.close();
      } catch {
        // ignore
      }
    }
    this.connections.clear();
    this.cachedLobby = null;
    await this.state.storage.deleteAll();
    return this.json({ ok: true });
  }

  private async handleUpdateLobby(
    lobby: LobbyState,
    payload: {
      lobbyName?: string;
      slots: { id?: string; name: string }[];
      roles: RoleId[];
      ladyEnabled: boolean;
    }
  ): Promise<Response> {
    if (lobby.gameState !== "lobby") {
      return this.json({ error: "Cannot edit lobby after start." }, 409);
    }

    const slots = payload.slots.map((slot) => ({
      id: slot.id,
      name: slot.name.trim()
    }));
    if (slots.length < 5) {
      return this.json({ error: "At least 5 players are required." }, 400);
    }
    if (slots.length > 10) {
      return this.json({ error: "No more than 10 players are allowed." }, 400);
    }
    if (slots.some((slot) => slot.name.length === 0)) {
      return this.json({ error: "Player names cannot be empty." }, 400);
    }

    const duplicate = findDuplicate(slots.map((slot) => slot.name));
    if (duplicate) {
      return this.json(
        { error: `Duplicate player name: ${duplicate}` },
        400
      );
    }

    const validation = validateRoleConfig(slots.length, payload.roles);
    if (!validation.ok) {
      return this.json({ error: validation.errors.join(" ") }, 400);
    }

    const existingById = new Map(
      lobby.playerSlots.map((slot) => [slot.id, slot])
    );
    const nextSlots: PlayerSlot[] = slots.map((slot) => {
      if (slot.id && existingById.has(slot.id)) {
        return { id: slot.id, name: slot.name };
      }
      return { id: crypto.randomUUID(), name: slot.name };
    });

    const nextIds = new Set(nextSlots.map((slot) => slot.id));
    const removedIds = lobby.playerSlots
      .map((slot) => slot.id)
      .filter((id) => !nextIds.has(id));

    for (const removedId of removedIds) {
      delete lobby.claimedByToken[removedId];
      this.sendKicked(removedId);
    }

    const nextClaims: Record<string, string> = {};
    for (const slot of nextSlots) {
      const token = lobby.claimedByToken[slot.id];
      if (token) {
        nextClaims[slot.id] = token;
      }
    }

    lobby.playerSlots = nextSlots;
    lobby.claimedByToken = nextClaims;
    lobby.lobbyName = payload.lobbyName?.trim() || undefined;
    lobby.roleConfig = { roles: payload.roles };
    lobby.ladyEnabled = Boolean(payload.ladyEnabled);

    await this.saveLobby(lobby);
    this.broadcastPublicState(lobby);
    this.broadcastPlayerStates(lobby);

    return this.json({ ok: true });
  }

  private handleWebSocket(): Response {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const connectionId = crypto.randomUUID();
    this.connections.set(connectionId, {
      socket: server,
      kind: "public"
    });

    server.addEventListener("message", (event) => {
      this.handleSocketMessage(connectionId, event.data);
    });
    server.addEventListener("close", () => {
      this.connections.delete(connectionId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  private async handleSocketMessage(
    connectionId: string,
    raw: string
  ): Promise<void> {
    let message: ClientMessage | null = null;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      this.sendToConnection(connectionId, {
        type: "error",
        message: "Invalid message."
      });
      return;
    }

    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    if (message.type === "ping") {
      this.sendToConnection(connectionId, { type: "pong" });
      return;
    }

    const lobby = await this.loadLobby();
    if (!lobby) {
      this.sendToConnection(connectionId, {
        type: "error",
        message: "Lobby not found."
      });
      return;
    }

    if (message.type === "join_public") {
      connection.kind = "public";
      connection.slotId = undefined;
      this.sendToConnection(connectionId, {
        type: "lobby_state",
        payload: this.buildPublicState(lobby)
      });
      return;
    }

    if (message.type === "join_host") {
      if (message.hostSecret !== lobby.hostSecret) {
        this.sendToConnection(connectionId, {
          type: "error",
          message: "Unauthorized."
        });
        return;
      }
      connection.kind = "host";
      connection.slotId = undefined;
      this.sendToConnection(connectionId, {
        type: "lobby_state",
        payload: this.buildHostState(lobby)
      });
      return;
    }

    if (message.type === "join_player") {
      const slot = this.slotFromToken(lobby, message.rejoinToken);
      if (!slot) {
        this.sendToConnection(connectionId, {
          type: "error",
          message: "Session invalid."
        });
        return;
      }
      connection.kind = "player";
      connection.slotId = slot.id;
      this.sendToConnection(connectionId, {
        type: "player_state",
        payload: this.buildPlayerState(lobby, slot.id)
      });
    }
  }

  private broadcastPublicState(lobby: LobbyState): void {
    const state = this.buildPublicState(lobby);
    for (const [connectionId, connection] of this.connections) {
      if (connection.kind === "player") {
        continue;
      }
      this.sendToConnection(connectionId, {
        type: "lobby_state",
        payload: state
      });
    }
  }

  private broadcastPlayerStates(lobby: LobbyState): void {
    for (const [connectionId, connection] of this.connections) {
      if (connection.kind !== "player" || !connection.slotId) {
        continue;
      }
      this.sendToConnection(connectionId, {
        type: "player_state",
        payload: this.buildPlayerState(lobby, connection.slotId)
      });
    }
  }

  private invalidatePlayerSession(slotId: string): void {
    for (const [connectionId, connection] of this.connections) {
      if (connection.kind === "player" && connection.slotId === slotId) {
        this.sendToConnection(connectionId, { type: "session_invalidated" });
      }
    }
  }

  private sendKicked(slotId: string): void {
    for (const [connectionId, connection] of this.connections) {
      if (connection.kind === "player" && connection.slotId === slotId) {
        this.sendToConnection(connectionId, { type: "kicked" });
      }
    }
  }

  private broadcastEvent(payload: unknown): void {
    for (const connectionId of this.connections.keys()) {
      this.sendToConnection(connectionId, payload);
    }
  }

  private nextCaptainIndex(lobby: LobbyState): number {
    if (!lobby.game) {
      return 0;
    }
    return (lobby.game.captainIndex + 1) % lobby.playerSlots.length;
  }

  private buildPublicState(lobby: LobbyState): PublicLobbyState {
    const players = lobby.playerSlots.map((slot) => ({
      id: slot.id,
      name: slot.name,
      claimed: Boolean(lobby.claimedByToken[slot.id])
    }));
    const joinedCount = players.filter((player) => player.claimed).length;
    return {
      lobbyCode: lobby.lobbyCode,
      lobbyName: lobby.lobbyName,
      gameState: lobby.gameState,
      players,
      joinedCount,
      allJoined: joinedCount === players.length,
      ladyEnabled: lobby.ladyEnabled,
      roleConfig: lobby.roleConfig,
      game: this.buildGameView(lobby)
    };
  }

  private buildHostState(lobby: LobbyState): HostLobbyState {
    return {
      ...this.buildPublicState(lobby),
      roleConfig: lobby.roleConfig
    };
  }

  private buildPlayerState(lobby: LobbyState, slotId: string): PlayerState {
    const slot = lobby.playerSlots.find((candidate) => candidate.id === slotId);
    const players = lobby.playerSlots.map((player) => ({
      id: player.id,
      name: player.name,
      claimed: Boolean(lobby.claimedByToken[player.id])
    }));
    if (!slot) {
      return {
        lobbyCode: lobby.lobbyCode,
        lobbyName: lobby.lobbyName,
        gameState: lobby.gameState,
        player: { id: slotId, name: "Unknown" },
        players,
        roleConfig: lobby.roleConfig,
        ladyEnabled: lobby.ladyEnabled
      };
    }

    if (lobby.gameState !== "started" || !lobby.assignments) {
      return {
        lobbyCode: lobby.lobbyCode,
        lobbyName: lobby.lobbyName,
        gameState: lobby.gameState,
        player: { id: slot.id, name: slot.name },
        players,
        roleConfig: lobby.roleConfig,
        ladyEnabled: lobby.ladyEnabled,
        game: this.buildGameView(lobby, slot.id)
      };
    }

    const knowledgeMap = buildKnowledgeMap(lobby.playerSlots, lobby.assignments);
    const knowledge = knowledgeMap[slotId];

    return {
      lobbyCode: lobby.lobbyCode,
      lobbyName: lobby.lobbyName,
      gameState: lobby.gameState,
      player: { id: slot.id, name: slot.name },
      players,
      role: {
        id: knowledge.roleId,
        name: roleLabel(knowledge.roleId),
        alignment: roleAlignment(knowledge.roleId)
      },
      knowledge: knowledge.entries.map((entry) => ({
        name: entry.name,
        tag: entry.tag
      })),
      roleConfig: lobby.roleConfig,
      ladyEnabled: lobby.ladyEnabled,
      game: this.buildGameView(lobby, slot.id)
    };
  }

  private buildGameView(
    lobby: LobbyState,
    viewerSlotId?: string
  ): GamePublicView | GamePlayerView | undefined {
    const game = lobby.game;
    if (!game) {
      return undefined;
    }

    const playerCount = lobby.playerSlots.length;
    const captainId = lobby.playerSlots[game.captainIndex]?.id ?? null;
    const missionSize = getMissionTeamSize(playerCount, game.missionIndex);

    const teamVotes = Object.values(game.teamVotes);
    const teamVoteDone =
      teamVotes.length === playerCount && playerCount > 0;
    const approve = teamVoteDone
      ? teamVotes.filter((vote) => vote === "approve").length
      : undefined;
    const reject = teamVoteDone
      ? teamVotes.filter((vote) => vote === "reject").length
      : undefined;

    const missionVotes = Object.values(game.missionVotes);
    const missionVoteDone =
      missionVotes.length === game.currentTeam.length &&
      game.currentTeam.length > 0;

    const ladyUses = gameLadyUses(game.lady) ? game.lady.uses : [];

    const publicView: GamePublicView = {
      phase: game.phase,
      missionIndex: game.missionIndex,
      captainId,
      missionSize,
      currentTeamIds: game.currentTeam,
      teamVote: {
        approve,
        reject,
        total: playerCount,
        pending: Math.max(playerCount - teamVotes.length, 0),
        done: teamVoteDone
      },
      missionVote: {
        submitted: missionVotes.length,
        total: game.currentTeam.length,
        pending: Math.max(game.currentTeam.length - missionVotes.length, 0),
        done: missionVoteDone,
        failsRequired: getFailsRequired(playerCount, game.missionIndex)
      },
      history: game.history,
      scores: game.scores,
      teamRejections: game.teamRejections,
      lady: {
        enabled: game.lady.enabled,
        holderId: game.lady.holderId,
        lastUsedMissionIndex: game.lady.lastUsedMissionIndex
      },
      ladyUses,
      lastTeamVote: game.lastTeamVote,
      assassination: game.assassination,
      winner: game.winner
    };

    if (!viewerSlotId) {
      return publicView;
    }

    const roleId = lobby.assignments?.[viewerSlotId];
    const alignment = roleId ? roleAlignment(roleId) : "good";
    const canFail = alignment === "evil";
    const ladyAvailableFrom = 1;
    const canUseLady =
      game.lady.enabled &&
      viewerSlotId === game.lady.holderId &&
      game.missionIndex >= ladyAvailableFrom &&
      (game.lady.lastUsedMissionIndex === null ||
        game.missionIndex > game.lady.lastUsedMissionIndex) &&
      game.phase !== "complete" &&
      game.phase !== "assassination";

    const playerView: GamePlayerView = {
      ...publicView,
      player: {
        isCaptain: viewerSlotId === captainId,
        isOnTeam: game.currentTeam.includes(viewerSlotId),
        hasTeamVote: Boolean(game.teamVotes[viewerSlotId]),
        hasMissionVote: Boolean(game.missionVotes[viewerSlotId]),
        canFail,
        canUseLady,
        ladyAvailableFrom,
        ladyReveal:
          viewerSlotId === game.lady.revealed?.viewerId
            ? {
                targetId: game.lady.revealed.targetId,
                alignment: game.lady.revealed.alignment
              }
            : undefined
      }
    };

    return playerView;
  }

  private async loadLobby(): Promise<LobbyState | null> {
    if (this.cachedLobby) {
      return this.cachedLobby;
    }
    const lobby = await this.state.storage.get<LobbyState>(LOBBY_STORAGE_KEY);
    if (lobby) {
      this.cachedLobby = lobby;
    }
    return lobby ?? null;
  }

  private async saveLobby(lobby: LobbyState): Promise<void> {
    this.cachedLobby = lobby;
    await this.state.storage.put(LOBBY_STORAGE_KEY, lobby);
  }

  private isExpired(lobby: LobbyState): boolean {
    return Date.now() > new Date(lobby.expiresAt).getTime();
  }

  private async expireLobby(): Promise<void> {
    this.cachedLobby = null;
    await this.state.storage.deleteAll();
  }

  private slotFromToken(lobby: LobbyState, token: string): PlayerSlot | null {
    const slotEntry = Object.entries(lobby.claimedByToken).find(
      ([, storedToken]) => storedToken === token
    );
    if (!slotEntry) {
      return null;
    }
    const slotId = slotEntry[0];
    return lobby.playerSlots.find((slot) => slot.id === slotId) ?? null;
  }

  private sendToConnection(connectionId: string, payload: unknown): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }
    try {
      connection.socket.send(JSON.stringify(payload));
    } catch {
      this.connections.delete(connectionId);
    }
  }

  private json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}

function roleLabel(roleId: RoleId): string {
  switch (roleId) {
    case "merlin":
      return "Merlin";
    case "assassin":
      return "Assassin";
    case "percival":
      return "Percival";
    case "morgana":
      return "Morgana";
    case "mordred":
      return "Mordred";
    case "oberon":
      return "Oberon";
    case "good":
      return "Loyal Servant";
    case "evil":
      return "Minion of Mordred";
    default:
      return roleId;
  }
}

function findDuplicate(values: string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);
  }
  return null;
}

function gameLadyUses(
  lady: { uses?: { missionIndex: number; viewerId: string; targetId: string }[] }
): lady is {
  uses: { missionIndex: number; viewerId: string; targetId: string }[];
} {
  return Array.isArray(lady.uses);
}
