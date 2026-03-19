"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  abortGame,
  deleteLobby,
  getHostState,
  resetSlot,
  startGame,
  updateLobby,
  type HostLobbyState
} from "@/lib/api";
import { loadHostSecret, loadHostSlotId } from "@/lib/storage";
import { createLobbySocket } from "@/lib/ws";
import { MissionBoard } from "@/components/MissionBoard";
import { buildRoleConfig, ROLE_DEFINITIONS } from "@/lib/roles";
import { Input } from "@/components/Input";
import { TogglePill } from "@/components/TogglePill";

export default function HostLobbyPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code?.toUpperCase() ?? "";
  const [hostSecret, setHostSecret] = useState<string | null>(null);
  const [hostSlotId, setHostSlotId] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<HostLobbyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [joinUrl, setJoinUrl] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [editLobbyName, setEditLobbyName] = useState("");
  const [editPlayers, setEditPlayers] = useState<
    { id?: string; name: string }[]
  >([]);
  const [roleOptions, setRoleOptions] = useState({
    percival: false,
    morgana: false,
    mordred: false,
    oberon: false
  });
  const [ladyEnabled, setLadyEnabled] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setHostSecret(loadHostSecret(code));
    setHostSlotId(loadHostSlotId(code));
    setJoinUrl(`${window.location.origin}/join/${code}`);
  }, [code]);

  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 240,
      color: { dark: "#F5F5F7", light: "#0B0B12" }
    })
      .then(setQrCode)
      .catch(() => setQrCode(null));
  }, [joinUrl]);

  useEffect(() => {
    if (!hostSecret) {
      return;
    }
    getHostState(code, hostSecret)
      .then(setLobbyState)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load lobby.")
      );
  }, [code, hostSecret]);

  useEffect(() => {
    if (!hostSecret) {
      return;
    }
    const socket = createLobbySocket(code, {
      onMessage: (message) => {
        if (message.type === "lobby_state") {
          setLobbyState(message.payload as HostLobbyState);
        }
        if (message.type === "lobby_deleted") {
          router.push("/");
        }
        if (message.type === "error") {
          setError(String(message.message ?? "Socket error."));
        }
      }
    });
    socket.send({ type: "join_host", hostSecret });
    return () => socket.close();
  }, [code, hostSecret]);

  const totalPlayers = editPlayers.length;
  const roleConfig = useMemo(
    () => buildRoleConfig(totalPlayers, roleOptions),
    [totalPlayers, roleOptions]
  );
  const roleSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const role of roleConfig.roles) {
      const name = ROLE_DEFINITIONS[role].name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) =>
      count > 1 ? `${name} x${count}` : name
    );
  }, [roleConfig.roles]);

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        lobbyName: editLobbyName.trim() || "",
        players: editPlayers.map((player) => ({
          id: player.id ?? "",
          name: player.name.trim()
        })),
        roles: roleConfig.roles,
        ladyEnabled
      }),
    [editLobbyName, editPlayers, roleConfig.roles, ladyEnabled]
  );

  useEffect(() => {
    if (!lobbyState || lobbyState.gameState !== "lobby") {
      return;
    }
    const snapshot = JSON.stringify({
      lobbyName: lobbyState.lobbyName || "",
      players: lobbyState.players.map((player) => ({
        id: player.id,
        name: player.name
      })),
      roles: lobbyState.roleConfig.roles,
      ladyEnabled: lobbyState.ladyEnabled
    });

    if (!dirty) {
      setEditLobbyName(lobbyState.lobbyName || "");
      setEditPlayers(
        lobbyState.players.map((player) => ({
          id: player.id,
          name: player.name
        }))
      );
      setRoleOptions({
        percival: lobbyState.roleConfig.roles.includes("percival"),
        morgana: lobbyState.roleConfig.roles.includes("morgana"),
        mordred: lobbyState.roleConfig.roles.includes("mordred"),
        oberon: lobbyState.roleConfig.roles.includes("oberon")
      });
      setLadyEnabled(lobbyState.ladyEnabled);
      setBaselineSnapshot(snapshot);
      setSavedVisible(false);
    }
  }, [lobbyState?.lobbyName, lobbyState?.players, lobbyState?.gameState]);

  useEffect(() => {
    if (baselineSnapshot === null) {
      setBaselineSnapshot(currentSnapshot);
      setDirty(false);
      return;
    }
    const hasChanges = baselineSnapshot !== currentSnapshot;
    setDirty(hasChanges);
    if (hasChanges) {
      setSavedVisible(false);
      setEditError(null);
    }
  }, [baselineSnapshot, currentSnapshot]);

  const allJoined = lobbyState?.allJoined ?? false;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setError("Unable to copy join link.");
    }
  };

  const handleReset = async (slotId: string) => {
    if (!hostSecret) return;
    try {
      await resetSlot(code, hostSecret, slotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    }
  };

  const handleStart = async () => {
    if (!hostSecret) return;
    try {
      await startGame(code, hostSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start game.");
    }
  };

  const joinedLabel = useMemo(() => {
    if (!lobbyState) return "";
    return `${lobbyState.joinedCount}/${lobbyState.players.length} joined`;
  }, [lobbyState]);

  const hostPlayerName = useMemo(() => {
    if (!lobbyState || !hostSlotId) return null;
    return lobbyState.players.find((player) => player.id === hostSlotId)?.name;
  }, [lobbyState, hostSlotId]);

  const game = lobbyState?.game;

  if (!hostSecret) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b12] px-6">
        <Card className="max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold text-white">
            Host access not found
          </h1>
          <p className="text-sm text-white/60">
            Open this page on the device that created the lobby to regain host
            controls.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b12] px-6 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300/70">
            Host lobby
          </p>
          <h1 className="text-2xl font-semibold text-white">
            {lobbyState?.lobbyName || "Avalon Lobby"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
            <span>Code: {code}</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>{joinedLabel}</span>
            {allJoined && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200">
                Everyone is in
              </span>
            )}
          </div>
        </header>

        {error && (
          <Card className="border border-rose-400/30 bg-rose-500/10 text-sm text-rose-200">
            {error}
          </Card>
        )}

        <Card className="space-y-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-white">Join link</h2>
            <p className="text-sm text-white/60">
              Share this link or let players scan the QR code.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-white/70">
              {joinUrl}
            </div>
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copyState === "copied" ? "Copied" : "Copy link"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "Avalon Lobby", url: joinUrl });
                }
              }}
            >
              Share
            </Button>
          </div>
          <div className="flex justify-center rounded-2xl border border-white/10 bg-black/30 px-4 py-6">
            {qrCode ? (
              <img
                src={qrCode}
                alt="Lobby join QR code"
                className="h-48 w-48 rounded-2xl border border-white/10"
              />
            ) : (
              <span className="text-xs text-white/50">Generating QR...</span>
            )}
          </div>
        </Card>

        {hostPlayerName && (
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-white">
              You are joined as {hostPlayerName}
            </h2>
            <p className="text-sm text-white/60">
              Open the player view to reveal your role once the game starts.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(`/join/${code}`, "_blank")}
            >
              Open player view
            </Button>
          </Card>
        )}

        {game && lobbyState?.players?.length ? (
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-white">Game board</h2>
                <p className="text-sm text-white/60">
                  Success {game.scores.success} · Fail {game.scores.fail}
                </p>
                <p className="text-xs text-white/50">
                  Vote tracker: {game.teamRejections}/5 rejects
                </p>
                {game.phase === "assassination" && (
                  <p className="text-xs text-amber-200">
                    Assassin is choosing Merlin.
                  </p>
                )}
                {game.phase === "complete" && (
                  <div className="space-y-1 text-xs">
                    <p
                      className={`${
                        game.winner === "evil" ? "text-rose-200" : "text-emerald-200"
                      }`}
                    >
                      Winner: {game.winner === "evil" ? "Evil" : "Good"}
                    </p>
                    <p className="text-white/70">
                      <span
                        className={
                          game.winner === "good"
                            ? "font-semibold text-emerald-200"
                            : "font-semibold text-rose-200"
                        }
                      >
                        Good: {game.winner === "good" ? "WIN" : "LOSS"}
                      </span>
                      {" · "}
                      <span
                        className={
                          game.winner === "evil"
                            ? "font-semibold text-emerald-200"
                            : "font-semibold text-rose-200"
                        }
                      >
                        Evil: {game.winner === "evil" ? "WIN" : "LOSS"}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
            <MissionBoard players={lobbyState.players} game={game} />
          </Card>
        ) : null}

        {lobbyState?.gameState === "lobby" && (
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Lobby settings
              </h2>
              <p className="text-sm text-white/60">
                Update players, roles, and extras before starting.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                Lobby name
              </label>
              <Input
                value={editLobbyName}
                onChange={(event) => setEditLobbyName(event.target.value)}
                placeholder="Avalon Night"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                Players ({editPlayers.length})
              </label>
              <div className="space-y-2">
                {editPlayers.map((player, index) => (
                  <div key={player.id ?? index} className="flex gap-2">
                    <Input
                      value={player.name}
                      onChange={(event) => {
                        const next = [...editPlayers];
                        next[index] = { ...next[index], name: event.target.value };
                        setEditPlayers(next);
                      }}
                      placeholder={`Player ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (editPlayers.length <= 5) return;
                        setEditPlayers(editPlayers.filter((_, i) => i !== index));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setEditPlayers([...editPlayers, { name: "" }])
                }
                disabled={editPlayers.length >= 10}
              >
                Add player
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                Special roles
              </label>
              <div className="flex flex-wrap gap-2">
                <TogglePill
                  active={roleOptions.percival}
                  label="Percival"
                  onClick={() =>
                    setRoleOptions((prev) => ({
                      ...prev,
                      percival: !prev.percival
                    }))
                  }
                />
                <TogglePill
                  active={roleOptions.morgana}
                  label="Morgana"
                  onClick={() =>
                    setRoleOptions((prev) => ({
                      ...prev,
                      morgana: !prev.morgana
                    }))
                  }
                />
                <TogglePill
                  active={roleOptions.mordred}
                  label="Mordred"
                  onClick={() =>
                    setRoleOptions((prev) => ({
                      ...prev,
                      mordred: !prev.mordred
                    }))
                  }
                />
                <TogglePill
                  active={roleOptions.oberon}
                  label="Oberon"
                  onClick={() =>
                    setRoleOptions((prev) => ({
                      ...prev,
                      oberon: !prev.oberon
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                Extras
              </label>
              <div className="flex flex-wrap gap-2">
                <TogglePill
                  active={ladyEnabled}
                  label="Lady of the Lake"
                  onClick={() => setLadyEnabled((prev) => !prev)}
                />
              </div>
            </div>

            <div className="space-y-1 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Role mix
              </p>
              <p className="text-sm text-white">
                {roleSummary.length ? roleSummary.join(" · ") : "—"}
              </p>
              {roleConfig.errors.length > 0 && (
                <p className="text-xs text-rose-300">
                  {roleConfig.errors.join(" ")}
                </p>
              )}
            </div>

            {editError && (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {editError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={async () => {
                  if (!hostSecret) return;
                  setEditError(null);
                  if (editPlayers.some((player) => player.name.trim().length === 0)) {
                    setEditError("All player names must be filled out.");
                    return;
                  }
                  if (editPlayers.length < 5 || editPlayers.length > 10) {
                    setEditError("Lobby must have 5 to 10 players.");
                    return;
                  }
                  const names = editPlayers.map((player) => player.name.trim());
                  const duplicate = findDuplicate(names);
                  if (duplicate) {
                    setEditError(`Duplicate player name: ${duplicate}`);
                    return;
                  }
                  if (roleConfig.errors.length) {
                    setEditError(roleConfig.errors.join(" "));
                    return;
                  }
                  try {
                    setSaving(true);
                    await updateLobby(code, {
                      hostSecret,
                      lobbyName: editLobbyName.trim() || undefined,
                      slots: editPlayers.map((player) => ({
                        id: player.id,
                        name: player.name
                      })),
                      roles: roleConfig.roles,
                      ladyEnabled
                    });
                    setBaselineSnapshot(currentSnapshot);
                    setDirty(false);
                    setSavedVisible(true);
                  } catch (err) {
                    setEditError(
                      err instanceof Error ? err.message : "Update failed."
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || !dirty}
                className={`${
                  dirty
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
                    : "bg-emerald-500/40 text-white/70"
                }`}
              >
                {saving
                  ? "Saving..."
                  : dirty
                    ? "Save changes"
                    : "Saved"}
              </Button>
              {savedVisible && (
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Saved
                </span>
              )}
            </div>
          </Card>
        )}

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Admin controls</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!hostSecret) return;
                try {
                  await abortGame(code, hostSecret);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Unable to abort game."
                  );
                }
              }}
              disabled={lobbyState?.gameState !== "started"}
            >
              {game?.phase === "complete" ? "Finish game" : "Abort game"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                if (!hostSecret) return;
                try {
                  await deleteLobby(code, hostSecret);
                  router.push("/");
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Unable to delete lobby."
                  );
                }
              }}
            >
              Delete lobby
            </Button>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Players</h2>
            <Button
              type="button"
              onClick={handleStart}
              disabled={!allJoined || lobbyState?.gameState === "started"}
            >
              {lobbyState?.gameState === "started"
                ? "Game started"
                : "Start game"}
            </Button>
          </div>
          <div className="space-y-2">
            {lobbyState?.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 ${
                  player.claimed
                    ? "bg-white/10"
                    : "bg-black/30 text-white/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      player.claimed
                        ? "bg-emerald-400"
                        : "bg-white/30 animate-pulse"
                    }`}
                  />
                  <span className="text-sm font-semibold">{player.name}</span>
                </div>
                {player.claimed && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleReset(player.id)}
                  >
                    Reset
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
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
