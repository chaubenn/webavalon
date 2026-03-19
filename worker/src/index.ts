import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { LobbyDurableObject } from "./lobby-do";
import {
  validateRoleConfig,
  type RoleConfig,
  type RoleId
} from "./rules";

type Env = {
  LOBBY: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({ origin: "*" }));

app.get("/health", (c) => c.text("ok"));

app.post("/api/lobbies", async (c) => {
  const body = await c.req.json<{
    hostName: string;
    lobbyName?: string;
    playerNames: string[];
    roles: RoleId[];
    ladyEnabled: boolean;
  }>();

  const hostName = body.hostName?.trim();
  const lobbyName = body.lobbyName?.trim() || undefined;
  const playerNames = body.playerNames.map((name) => name.trim());

  if (!hostName) {
    return c.json({ error: "Host name is required." }, 400);
  }

  const allNames = [hostName, ...playerNames];

  if (allNames.length < 5) {
    return c.json({ error: "At least 5 players are required." }, 400);
  }
  if (allNames.length > 10) {
    return c.json({ error: "No more than 10 players are allowed." }, 400);
  }
  if (allNames.some((name) => name.length === 0)) {
    return c.json({ error: "Player names cannot be empty." }, 400);
  }

  const duplicateName = findDuplicate(allNames);
  if (duplicateName) {
    return c.json(
      { error: `Duplicate player name: ${duplicateName}` },
      400
    );
  }

  const roleConfig: RoleConfig = { roles: body.roles };
  const validation = validateRoleConfig(allNames.length, roleConfig.roles);
  if (!validation.ok) {
    return c.json({ error: validation.errors.join(" ") }, 400);
  }

  const lobbyCode = await createLobbyCode(c.env);
  const hostSecret = crypto.randomUUID();

  const playerSlots = allNames.map((name) => ({
    id: crypto.randomUUID(),
    name
  }));
  const hostSlotId = playerSlots[0].id;
  const hostPlayerToken = crypto.randomUUID();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  const lobbyState = {
    lobbyCode,
    lobbyName,
    hostSecret,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    playerSlots,
    claimedByToken: { [hostSlotId]: hostPlayerToken },
    roleConfig,
    gameState: "lobby" as const,
    ladyEnabled: Boolean(body.ladyEnabled)
  };

  const stub = c.env.LOBBY.get(c.env.LOBBY.idFromName(lobbyCode));
  const initResponse = await stub.fetch("https://lobby/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lobbyState)
  });

  if (!initResponse.ok) {
    return c.json({ error: "Failed to create lobby." }, 500);
  }

  return c.json({
    lobbyCode,
    hostSecret,
    hostPlayerToken,
    hostSlotId,
    lobbyName,
    playerSlots,
    roleConfig
  });
});

app.get("/api/lobbies/:code/state", async (c) => {
  const stub = getStub(c);
  const response = await stub.fetch("https://lobby/state");
  return response;
});

app.post("/api/lobbies/:code/host-state", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ hostSecret: string }>();
  const response = await stub.fetch("https://lobby/host-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/claim", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ slotId: string }>();
  const response = await stub.fetch("https://lobby/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/rejoin", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ token: string }>();
  const response = await stub.fetch("https://lobby/rejoin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/reset", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ hostSecret: string; slotId: string }>();
  const response = await stub.fetch("https://lobby/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/start", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ hostSecret: string }>();
  const response = await stub.fetch("https://lobby/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/team", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ token: string; teamIds: string[] }>();
  const response = await stub.fetch("https://lobby/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/team-vote", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{
    token: string;
    vote: "approve" | "reject";
  }>();
  const response = await stub.fetch("https://lobby/team-vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/mission-vote", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{
    token: string;
    vote: "success" | "fail";
  }>();
  const response = await stub.fetch("https://lobby/mission-vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/next", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ hostSecret: string }>();
  const response = await stub.fetch("https://lobby/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/lady", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ token: string; targetId: string }>();
  const response = await stub.fetch("https://lobby/lady", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/assassinate", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ token: string; targetId: string }>();
  const response = await stub.fetch("https://lobby/assassinate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/abort", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ hostSecret: string }>();
  const response = await stub.fetch("https://lobby/abort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/delete", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{ hostSecret: string }>();
  const response = await stub.fetch("https://lobby/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.post("/api/lobbies/:code/update", async (c) => {
  const stub = getStub(c);
  const body = await c.req.json<{
    hostSecret: string;
    lobbyName?: string;
    slots: { id?: string; name: string }[];
    roles: RoleId[];
    ladyEnabled: boolean;
  }>();
  const response = await stub.fetch("https://lobby/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response;
});

app.get("/api/lobbies/:code/ws", async (c) => {
  const stub = getStub(c);
  const request = new Request("https://lobby/ws", c.req.raw);
  return stub.fetch(request);
});

export { LobbyDurableObject };
export default app;

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

async function createLobbyCode(env: Env): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = Array.from({ length: 5 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("");
    const stub = env.LOBBY.get(env.LOBBY.idFromName(code));
    const response = await stub.fetch("https://lobby/state");
    if (response.status === 404) {
      return code;
    }
  }
  throw new Error("Unable to generate lobby code.");
}

function getStub(c: Context<{ Bindings: Env }>): DurableObjectStub {
  const code = c.req.param("code").toUpperCase();
  return c.env.LOBBY.get(c.env.LOBBY.idFromName(code));
}
