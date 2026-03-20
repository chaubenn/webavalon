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
      color: { dark: "#e8dcc8", light: "#07090d" }
    })
      .then(setQrCode)
      .catch(() => setQrCode(null));
  }, [joinUrl]);

  useEffect(() => {
    if (!hostSecret) return;
    getHostState(code, hostSecret)
      .then(setLobbyState)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load the council.")
      );
  }, [code, hostSecret]);

  useEffect(() => {
    if (!hostSecret) return;
    const socket = createLobbySocket(code, {
      onMessage: (message) => {
        if (message.type === "lobby_state") {
          setLobbyState(message.payload as HostLobbyState);
        }
        if (message.type === "lobby_deleted") {
          router.push("/");
        }
        if (message.type === "error") {
          setError(String(message.message ?? "A disturbance in the realm."));
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
      count > 1 ? `${name} ×${count}` : name
    );
  }, [roleConfig.roles]);

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        lobbyName: editLobbyName.trim() || "",
        players: editPlayers.map((p) => ({ id: p.id ?? "", name: p.name.trim() })),
        roles: roleConfig.roles,
        ladyEnabled
      }),
    [editLobbyName, editPlayers, roleConfig.roles, ladyEnabled]
  );

  useEffect(() => {
    if (!lobbyState || lobbyState.gameState !== "lobby") return;
    const snapshot = JSON.stringify({
      lobbyName: lobbyState.lobbyName || "",
      players: lobbyState.players.map((p) => ({ id: p.id, name: p.name })),
      roles: lobbyState.roleConfig.roles,
      ladyEnabled: lobbyState.ladyEnabled
    });
    if (!dirty) {
      setEditLobbyName(lobbyState.lobbyName || "");
      setEditPlayers(
        lobbyState.players.map((p) => ({ id: p.id, name: p.name }))
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
      setError("Unable to copy the seal.");
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
      setError(err instanceof Error ? err.message : "The quest could not begin.");
    }
  };

  const joinedLabel = useMemo(() => {
    if (!lobbyState) return "";
    return `${lobbyState.joinedCount}/${lobbyState.players.length} knights present`;
  }, [lobbyState]);

  const hostPlayerName = useMemo(() => {
    if (!lobbyState || !hostSlotId) return null;
    return lobbyState.players.find((p) => p.id === hostSlotId)?.name;
  }, [lobbyState, hostSlotId]);

  const game = lobbyState?.game;

  if (!hostSecret) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07090d] px-6">
        <Card className="max-w-md space-y-3 text-center">
          <div className="text-3xl text-[var(--gold-dim)]">⚔</div>
          <h1 className="font-display text-lg font-semibold text-[var(--foreground)]">
            The Seal is Absent
          </h1>
          <p className="text-sm text-[var(--parchment-dim)]">
            Return to the device that summoned this council to reclaim your host
            powers.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090d] px-6 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">

        {/* Header */}
        <header className="space-y-2">
          <p className="font-display text-xs tracking-[0.3em] uppercase text-[var(--gold-dim)]">
            ✦ &nbsp; The Round Table
          </p>
          <h1 className="font-display text-2xl font-semibold text-[var(--foreground)]">
            {lobbyState?.lobbyName || "Avalon Council"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--parchment-dim)]">
            <span className="font-display tracking-wider">Code: {code}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--gold-dim)]" />
            <span>{joinedLabel}</span>
            {allJoined && (
              <span className="rounded-full border border-[rgba(42,122,74,0.5)] bg-[rgba(26,74,46,0.5)] px-3 py-0.5 text-xs font-display text-[var(--realm-green-bright)]">
                All knights present
              </span>
            )}
          </div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--gold-dim)] to-transparent opacity-30" />
        </header>

        {error && (
          <div className="rounded-xl border border-[rgba(155,32,32,0.4)] bg-[rgba(107,18,18,0.3)] px-4 py-3 text-sm text-[var(--crimson-bright)]">
            {error}
          </div>
        )}

        {/* Join link */}
        <Card className="space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--foreground)]">
              The Seal of Entry
            </h2>
            <p className="mt-1 text-sm text-[var(--parchment-dim)]">
              Share this link or let each knight scan the seal.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1 rounded-xl border border-[rgba(201,168,76,0.15)] bg-[#07090d] px-4 py-3 text-xs text-[var(--parchment-dim)] break-all">
              {joinUrl}
            </div>
            <Button variant="outline" onClick={handleCopy}>
              {copyState === "copied" ? "✦ Copied" : "Copy seal"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "Avalon Council", url: joinUrl });
                }
              }}
            >
              Share
            </Button>
          </div>
          <div className="flex justify-center rounded-xl border border-[rgba(201,168,76,0.15)] bg-[#07090d] px-4 py-6">
            {qrCode ? (
              <img
                src={qrCode}
                alt="Council entry QR seal"
                className="h-48 w-48 rounded-xl"
              />
            ) : (
              <span className="text-xs text-[var(--parchment-dim)]/50">
                Inscribing seal…
              </span>
            )}
          </div>
        </Card>

        {/* Host as player */}
        {hostPlayerName && (
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-base font-semibold text-[var(--foreground)]">
              You ride as{" "}
              <span className="text-[var(--gold)]">{hostPlayerName}</span>
            </h2>
            <p className="text-sm text-[var(--parchment-dim)]">
              Open your knight&apos;s view to reveal your role once the quest begins.
            </p>
            <Button
              variant="outline"
              onClick={() => window.open(`/join/${code}`, "_blank")}
            >
              Open knight&apos;s view
            </Button>
          </Card>
        )}

        {/* Game board */}
        {game && lobbyState?.players?.length ? (
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-[var(--foreground)]">
                  The Quest Board
                </h2>
                <div className="mt-1 flex flex-wrap gap-4 text-sm text-[var(--parchment-dim)]">
                  <span>
                    <span className="text-[var(--realm-green-bright)]">
                      {game.scores.success}
                    </span>{" "}
                    victories
                  </span>
                  <span>
                    <span className="text-[var(--crimson-bright)]">
                      {game.scores.fail}
                    </span>{" "}
                    betrayals
                  </span>
                  <span>{game.teamRejections}/5 rejections</span>
                  <span>
                    ⚔ Captain:{" "}
                    <span className="text-[var(--foreground)]">
                      {game.captainId
                        ? (lobbyState.players.find((p) => p.id === game.captainId)?.name ?? "—")
                        : "—"}
                    </span>
                  </span>
                </div>
                {game.phase === "assassination" && (
                  <p className="mt-2 text-xs text-[var(--gold)] font-display tracking-wide">
                    ⚔ The Assassin is choosing…
                  </p>
                )}
                {game.phase === "complete" && (
                  <div className="mt-2 space-y-0.5 text-sm">
                    <p
                      className={`font-display font-semibold ${
                        game.winner === "evil"
                          ? "text-[var(--crimson-bright)]"
                          : "text-[var(--realm-green-bright)]"
                      }`}
                    >
                      {game.winner === "evil"
                        ? "Evil claims the realm"
                        : "The realm is saved"}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <MissionBoard players={lobbyState.players} game={game} />
          </Card>
        ) : null}

        {/* Lobby settings */}
        {lobbyState?.gameState === "lobby" && (
          <Card className="space-y-5">
            <div>
              <h2 className="font-display text-base font-semibold text-[var(--foreground)]">
                Council Settings
              </h2>
              <p className="mt-1 text-sm text-[var(--parchment-dim)]">
                Amend the council before the quest begins.
              </p>
            </div>

            <div className="space-y-2">
              <label className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
                Council Name
              </label>
              <Input
                value={editLobbyName}
                onChange={(e) => setEditLobbyName(e.target.value)}
                placeholder="The Round Table"
              />
            </div>

            <div className="space-y-2">
              <label className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
                Knights ({editPlayers.length})
              </label>
              <div className="space-y-2">
                {editPlayers.map((player, index) => (
                  <div key={player.id ?? index} className="flex gap-2">
                    <Input
                      value={player.name}
                      onChange={(e) => {
                        const next = [...editPlayers];
                        next[index] = { ...next[index], name: e.target.value };
                        setEditPlayers(next);
                      }}
                      placeholder={`Knight ${index + 1}`}
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
                onClick={() => setEditPlayers([...editPlayers, { name: "" }])}
                disabled={editPlayers.length >= 10}
              >
                + Add knight
              </Button>
            </div>

            <div className="space-y-2">
              <label className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
                Special Characters
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "percival", label: "Percival" },
                    { key: "morgana", label: "Morgana" },
                    { key: "mordred", label: "Mordred" },
                    { key: "oberon", label: "Oberon" }
                  ] as const
                ).map(({ key, label }) => (
                  <TogglePill
                    key={key}
                    active={roleOptions[key]}
                    label={label}
                    onClick={() =>
                      setRoleOptions((prev) => ({
                        ...prev,
                        [key]: !prev[key]
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
                Ancient Relics
              </label>
              <div className="flex flex-wrap gap-2">
                <TogglePill
                  active={ladyEnabled}
                  label="Lady of the Lake"
                  onClick={() => setLadyEnabled((prev) => !prev)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(201,168,76,0.15)] bg-[#07090d] p-4 space-y-1">
              <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
                Council Composition
              </p>
              <p className="text-sm text-[var(--foreground)]">
                {roleSummary.length ? roleSummary.join(" · ") : "—"}
              </p>
              {roleConfig.errors.length > 0 && (
                <p className="text-xs text-[var(--crimson-bright)]">
                  {roleConfig.errors.join(" ")}
                </p>
              )}
            </div>

            {editError && (
              <div className="rounded-xl border border-[rgba(155,32,32,0.4)] bg-[rgba(107,18,18,0.3)] px-4 py-3 text-sm text-[var(--crimson-bright)]">
                {editError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={async () => {
                  if (!hostSecret) return;
                  setEditError(null);
                  if (editPlayers.some((p) => p.name.trim().length === 0)) {
                    setEditError("All knights must be named.");
                    return;
                  }
                  if (editPlayers.length < 5 || editPlayers.length > 10) {
                    setEditError("The council must have 5 to 10 knights.");
                    return;
                  }
                  const names = editPlayers.map((p) => p.name.trim());
                  const duplicate = findDuplicate(names);
                  if (duplicate) {
                    setEditError(`Two knights share the name "${duplicate}".`);
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
                      slots: editPlayers.map((p) => ({
                        id: p.id,
                        name: p.name
                      })),
                      roles: roleConfig.roles,
                      ladyEnabled
                    });
                    setBaselineSnapshot(currentSnapshot);
                    setDirty(false);
                    setSavedVisible(true);
                  } catch (err) {
                    setEditError(
                      err instanceof Error ? err.message : "The change could not be issued."
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || !dirty}
                className={`${
                  dirty
                    ? "bg-[var(--realm-green-light)] text-white shadow-lg hover:bg-[var(--realm-green-bright)]"
                    : "bg-[var(--realm-green)]/40 text-white/50"
                }`}
              >
                {saving ? "Issuing change" : dirty ? "Issue Change" : "Changed"}
              </Button>
              {savedVisible && (
                <span className="rounded-full border border-[rgba(42,122,74,0.5)] bg-[rgba(26,74,46,0.5)] px-3 py-0.5 text-xs font-display text-[var(--realm-green-bright)]">
                  Sealed ✦
                </span>
              )}
            </div>
          </Card>
        )}

        {/* Admin */}
        <Card className="space-y-3">
          <h2 className="font-display text-base font-semibold text-[var(--foreground)]">
            The King&apos;s Command
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={async () => {
                if (!hostSecret) return;
                try {
                  await abortGame(code, hostSecret);
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "The quest could not be recalled."
                  );
                }
              }}
              disabled={lobbyState?.gameState !== "started"}
              className="border-[rgba(155,32,32,0.45)] text-[var(--crimson-bright)] hover:bg-[rgba(107,18,18,0.2)]"
            >
              {game?.phase === "complete" ? "End Council" : "Recall the Quest"}
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                if (!hostSecret) return;
                try {
                  await deleteLobby(code, hostSecret);
                  router.push("/");
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "The council could not be dissolved."
                  );
                }
              }}
            >
              Dissolve Council
            </Button>
          </div>
        </Card>

        {/* Knights list */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[var(--foreground)]">
              The Knights
            </h2>
            <Button
              onClick={handleStart}
              disabled={!allJoined || lobbyState?.gameState === "started"}
            >
              {lobbyState?.gameState === "started"
                ? "Quest underway"
                : "Dispatch the Quest"}
            </Button>
          </div>
          <div className="space-y-2">
            {lobbyState?.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                  player.claimed
                    ? "border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.05)]"
                    : "border-[rgba(201,168,76,0.08)] bg-[#07090d] opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      player.claimed
                        ? "bg-[var(--realm-green-bright)]"
                        : "bg-[var(--parchment-dim)]/30 animate-pulse"
                    }`}
                  />
                  <span className="text-sm text-[var(--foreground)]">
                    {player.name}
                  </span>
                </div>
                {player.claimed && (
                  <Button
                    variant="ghost"
                    onClick={() => handleReset(player.id)}
                    className="text-xs text-[var(--parchment-dim)]/60 hover:text-[var(--crimson-bright)]"
                  >
                    Release
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
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}
