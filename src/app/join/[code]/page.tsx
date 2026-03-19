"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { MissionBoard } from "@/components/MissionBoard";
import {
  assassinate,
  claimSlot,
  getLobbyState,
  rejoinLobby,
  selectTeam,
  submitMissionVote,
  submitTeamVote,
  useLady,
  type LobbyState,
  type PlayerState
} from "@/lib/api";
import {
  clearPlayerToken,
  loadPlayerToken,
  savePlayerToken
} from "@/lib/storage";
import { createLobbySocket } from "@/lib/ws";
import { ROLE_DEFINITIONS } from "@/lib/roles";

export default function JoinLobbyPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code?.toUpperCase() ?? "";
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [ladyTarget, setLadyTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getLobbyState(code)
      .then(setLobbyState)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Lobby not found.")
      );
  }, [code]);

  useEffect(() => {
    const stored = loadPlayerToken(code);
    if (!stored) return;
    setToken(stored);
    rejoinLobby(code, stored)
      .then(setPlayerState)
      .catch(() => {
        clearPlayerToken(code);
        setToken(null);
        setPlayerState(null);
      });
  }, [code]);


  useEffect(() => {
    const socket = createLobbySocket(code, {
      onMessage: (message) => {
        if (message.type === "lobby_state") {
          setLobbyState(message.payload as LobbyState);
        }
        if (message.type === "player_state") {
          setPlayerState(message.payload as PlayerState);
        }
        if (message.type === "session_invalidated") {
          clearPlayerToken(code);
          setToken(null);
          setPlayerState(null);
          setIsRevealing(false);
        }
        if (message.type === "kicked") {
          clearPlayerToken(code);
          setToken(null);
          setPlayerState(null);
          setIsRevealing(false);
          router.push("/");
        }
        if (message.type === "lobby_deleted") {
          clearPlayerToken(code);
          setToken(null);
          setPlayerState(null);
          setIsRevealing(false);
          router.push("/");
        }
        if (message.type === "game_aborted") {
          setNotice("Game aborted by host.");
          setIsRevealing(false);
        }
        if (message.type === "error") {
          setError(String(message.message ?? "Socket error."));
        }
      }
    });

    if (token) {
      socket.send({ type: "join_player", rejoinToken: token });
    } else {
      socket.send({ type: "join_public" });
    }
    return () => socket.close();
  }, [code, token]);

  const handleClaim = async (slotId: string) => {
    setError(null);
    try {
      const response = await claimSlot(code, slotId);
      savePlayerToken(code, response.rejoinToken);
      setToken(response.rejoinToken);
      const nextPlayers = lobbyState?.players ?? [];
      setPlayerState((prev) => ({
        lobbyCode: code,
        lobbyName: lobbyState?.lobbyName,
        gameState: response.gameState,
        player: response.player,
        players: nextPlayers,
        role: prev?.role,
        knowledge: prev?.knowledge,
        roleConfig: lobbyState?.roleConfig ?? prev?.roleConfig,
        ladyEnabled: lobbyState?.ladyEnabled ?? prev?.ladyEnabled ?? false
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to claim slot.");
    }
  };

  const displayName = playerState?.player.name ?? "Player";
  const lobbyName = playerState?.lobbyName ?? lobbyState?.lobbyName;
  const players = playerState?.players ?? lobbyState?.players ?? [];
  const roleConfig =
    playerState?.roleConfig ?? lobbyState?.roleConfig ?? null;
  const ladyStatus =
    playerState?.game?.lady.enabled ?? playerState?.ladyEnabled ?? lobbyState?.ladyEnabled ?? false;
  const playerMap = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players]
  );
  const game = playerState?.game;

  useEffect(() => {
    if (!game) return;
    if (game.phase === "team_select") {
      setSelectedTeam(game.currentTeamIds);
    } else {
      setSelectedTeam([]);
    }
    setActionError(null);
    setLadyTarget(null);
  }, [game?.phase, game?.missionIndex, game?.currentTeamIds?.join("|")]);

  const roleAlignment = useMemo(() => {
    if (!playerState?.role) return null;
    return playerState.role.alignment === "good"
      ? "Loyal"
      : "Evil";
  }, [playerState?.role]);

  const roleSummary = useMemo(() => {
    if (!roleConfig) return [];
    const counts = new Map<string, number>();
    for (const role of roleConfig.roles) {
      const name = ROLE_DEFINITIONS[role].name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) =>
      count > 1 ? `${name} x${count}` : name
    );
  }, [roleConfig]);


  if (!lobbyState && !playerState) {
    return (
      <div className="min-h-screen bg-[#0b0b12] px-6 py-10">
        <Card className="mx-auto max-w-md text-center text-sm text-white/60">
          Loading lobby...
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b12] px-6 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300/70">
            Lobby {code}
          </p>
          <h1 className="text-2xl font-semibold text-white">
            {lobbyName || "Avalon Lobby"}
          </h1>
          {playerState && (
            <p className="text-sm text-white/60">
              You are signed in as{" "}
              <span className="font-semibold text-white">{displayName}</span>
            </p>
          )}
        </header>

        {error && (
          <Card className="border border-rose-400/30 bg-rose-500/10 text-sm text-rose-200">
            {error}
          </Card>
        )}

        {notice && (
          <Card className="border border-amber-400/30 bg-amber-500/10 text-sm text-amber-100">
            {notice}
          </Card>
        )}

        {roleConfig && (
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Game settings</h2>
            <p className="text-sm text-white/60">
              {roleSummary.length ? roleSummary.join(" · ") : "Roles pending"}
            </p>
            <p className="text-xs text-white/50">
              Lady of the Lake: {ladyStatus ? "Enabled" : "Off"}
            </p>
          </Card>
        )}

        {!playerState && lobbyState && (
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Choose your name</h2>
            <p className="text-sm text-white/60">
              Tap your name to claim it. Claimed names are locked.
            </p>
            {lobbyState.gameState === "started" && (
              <p className="text-sm text-amber-200">
                The game has already started. Ask the host to reset your slot if
                you need to join.
              </p>
            )}
            <div className="space-y-2">
              {lobbyState.players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  disabled={player.claimed}
                  onClick={() => handleClaim(player.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-semibold ${
                    player.claimed
                      ? "bg-black/40 text-white/40"
                      : "bg-white/10 text-white hover:border-indigo-400"
                  }`}
                >
                  <span>{player.name}</span>
                  <span className="text-xs text-white/40">
                    {player.claimed ? "Claimed" : "Tap to claim"}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {playerState && (
          <Card className="space-y-4">
            {playerState.gameState === "lobby" && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-white">
                  Waiting for the host
                </h2>
                <p className="text-sm text-white/60">
                  Your role will appear once the game starts.
                </p>
              </div>
            )}

            {playerState.gameState === "started" && playerState.role && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Your role
                    </h2>
                    <p className="text-sm text-white/60">{displayName}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/40 px-5 py-6">
                  {!isRevealing ? (
                    <div className="space-y-3 text-center">
                      <p className="text-sm text-white/60">
                        Tap to reveal your role
                      </p>
                      <button
                        type="button"
                        className="w-full rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"
                        onClick={() => setIsRevealing(true)}
                      >
                        Reveal role
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200">
                          {roleAlignment}
                        </span>
                        <span className="text-lg font-semibold text-white">
                          {playerState.role.name}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {playerState.knowledge?.length ? (
                          playerState.knowledge.map((entry, index) => (
                            <div
                              key={`${entry.name}-${index}`}
                              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                            >
                              <span>{entry.name}</span>
                              <span className="text-xs text-white/60">
                                {entry.tag}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-white/60">
                            You have no additional information.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                        onClick={() => setIsRevealing(false)}
                      >
                        Hide role
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {game && players.length > 0 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">Captain:</span>
                    <span>
                      {game.captainId
                        ? playerMap.get(game.captainId) || "Unknown"
                        : "—"}
                    </span>
                    <span className="mx-2 h-1 w-1 rounded-full bg-white/30" />
                    <span className="text-white/60">
                      Phase: {game.phase.replace("_", " ")}
                    </span>
                    <span className="mx-2 h-1 w-1 rounded-full bg-white/30" />
                    <span className="text-white/60">
                      Vote tracker: {game.teamRejections}/5
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <MissionBoard players={players} game={game} />
                </div>

                {actionError && (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {actionError}
                  </div>
                )}

                {game.player.ladyReveal && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                    Lady reveal:{" "}
                    {playerMap.get(game.player.ladyReveal.targetId) || "Player"}{" "}
                    is{" "}
                    <span className="font-semibold text-white">
                      {game.player.ladyReveal.alignment.toUpperCase()}
                    </span>
                    .
                  </div>
                )}

                {game.phase === "team_select" && (
                  <div className="space-y-3">
                    {game.player.isCaptain ? (
                      <>
                        <p className="text-sm text-white/70">
                          Select {game.missionSize} players for Mission{" "}
                          {game.missionIndex + 1}.
                        </p>
                        <div className="grid gap-2">
                          {players.map((player) => {
                            const isSelected = selectedTeam.includes(player.id);
                            const canToggle =
                              isSelected ||
                              selectedTeam.length < game.missionSize;
                            return (
                              <button
                                key={player.id}
                                type="button"
                                onClick={() => {
                                  if (!canToggle) return;
                                  setSelectedTeam((prev) =>
                                    prev.includes(player.id)
                                      ? prev.filter((id) => id !== player.id)
                                      : [...prev, player.id]
                                  );
                                }}
                                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                                  isSelected
                                    ? "border-indigo-400 bg-indigo-500/20 text-white"
                                    : "border-white/10 bg-black/40 text-white/70"
                                }`}
                              >
                                <span>{player.name}</span>
                                <span className="text-xs">
                                  {isSelected ? "Selected" : "Tap to add"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <Button
                          type="button"
                          onClick={async () => {
                            if (!token) return;
                            setActionError(null);
                            try {
                              await selectTeam(code, token, selectedTeam);
                            } catch (err) {
                              setActionError(
                                err instanceof Error
                                  ? err.message
                                  : "Unable to set team."
                              );
                            }
                          }}
                          disabled={selectedTeam.length !== game.missionSize}
                        >
                          Confirm team
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-white/70">
                        Waiting for the captain to choose a team.
                      </p>
                    )}
                  </div>
                )}

                {game.phase === "team_vote" && (
                  <div className="space-y-3">
                    <p className="text-sm text-white/70">
                      Approve or reject the proposed team.
                    </p>
                    {!game.player.hasTeamVote ? (
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          onClick={async () => {
                            if (!token) return;
                            setActionError(null);
                            try {
                              await submitTeamVote(code, token, "approve");
                            } catch (err) {
                              setActionError(
                                err instanceof Error
                                  ? err.message
                                  : "Vote failed."
                              );
                            }
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            if (!token) return;
                            setActionError(null);
                            try {
                              await submitTeamVote(code, token, "reject");
                            } catch (err) {
                              setActionError(
                                err instanceof Error
                                  ? err.message
                                  : "Vote failed."
                              );
                            }
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-white/60">
                        Vote submitted. Waiting on others...
                      </p>
                    )}
                    {game.teamVote?.done && (
                      <p className="text-sm text-white/60">
                        Result: {game.teamVote.approve} approve ·{" "}
                        {game.teamVote.reject} reject
                      </p>
                    )}
                  </div>
                )}

                {game.phase === "mission_vote" && (
                  <div className="space-y-3">
                    {game.player.isOnTeam ? (
                      <>
                        <p className="text-sm text-white/70">
                          Submit your mission card.
                        </p>
                        {!game.player.hasMissionVote ? (
                          <div className="flex gap-3">
                            <Button
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                setActionError(null);
                                try {
                                  await submitMissionVote(code, token, "success");
                                } catch (err) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : "Vote failed."
                                  );
                                }
                              }}
                            >
                              Success
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!game.player.canFail}
                              onClick={async () => {
                                if (!token) return;
                                setActionError(null);
                                try {
                                  await submitMissionVote(code, token, "fail");
                                } catch (err) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : "Vote failed."
                                  );
                                }
                              }}
                            >
                              Fail
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-white/60">
                            Vote submitted. Waiting on the team...
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-white/60">
                        Mission in progress. Waiting for the team to vote.
                      </p>
                    )}
                  </div>
                )}


                {game.lady.enabled && game.lady.holderId && (
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
                    {game.lady.holderId === playerState?.player.id ? (
                      <div className="space-y-3">
                        <p className="font-semibold text-white">
                          You hold the Lady of the Lake
                        </p>
                        <p className="text-xs text-white/60">
                          Available from mission{" "}
                          {game.player.ladyAvailableFrom + 1}. Use once per
                          mission.
                        </p>
                        {game.player.canUseLady && (
                          <>
                            <div className="grid gap-2">
                              {players
                                .filter(
                                  (player) =>
                                    player.id !== game.lady.holderId
                                )
                                .map((player) => (
                                  <button
                                    key={player.id}
                                    type="button"
                                    onClick={() => setLadyTarget(player.id)}
                                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                                      ladyTarget === player.id
                                        ? "border-indigo-400 bg-indigo-500/20 text-white"
                                        : "border-white/10 bg-black/40 text-white/70"
                                    }`}
                                  >
                                    <span>{player.name}</span>
                                    <span className="text-xs">
                                      {ladyTarget === player.id
                                        ? "Selected"
                                        : "Tap to choose"}
                                    </span>
                                  </button>
                                ))}
                            </div>
                            <Button
                              type="button"
                              disabled={!ladyTarget || !token}
                              onClick={async () => {
                                if (!token || !ladyTarget) return;
                                setActionError(null);
                                try {
                                  await useLady(code, token, ladyTarget);
                                } catch (err) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : "Lady action failed."
                                  );
                                }
                              }}
                            >
                              Reveal alignment
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      <p>
                        Lady of the Lake held by{" "}
                        {playerMap.get(game.lady.holderId) || "player"}.
                      </p>
                    )}
                  </div>
                )}

                {game.phase === "assassination" && (
                  <div className="space-y-3">
                    {playerState?.role?.id === "assassin" ? (
                      <>
                        <p className="text-sm text-white/70">
                          Choose the player you believe is Merlin.
                        </p>
                        <div className="grid gap-2">
                          {players.map((player) => (
                            <button
                              key={player.id}
                              type="button"
                              onClick={() => setLadyTarget(player.id)}
                              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                                ladyTarget === player.id
                                  ? "border-rose-400 bg-rose-500/20 text-white"
                                  : "border-white/10 bg-black/40 text-white/70"
                              }`}
                            >
                              <span>{player.name}</span>
                              <span className="text-xs">
                                {ladyTarget === player.id
                                  ? "Selected"
                                  : "Tap to choose"}
                              </span>
                            </button>
                          ))}
                        </div>
                        <Button
                          type="button"
                          disabled={!ladyTarget || !token}
                          onClick={async () => {
                            if (!token || !ladyTarget) return;
                            setActionError(null);
                            try {
                              await assassinate(code, token, ladyTarget);
                            } catch (err) {
                              setActionError(
                                err instanceof Error
                                  ? err.message
                                  : "Assassination failed."
                              );
                            }
                          }}
                        >
                          Confirm assassination
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-white/60">
                        Waiting for the assassin to act.
                      </p>
                    )}
                  </div>
                )}

                {game.phase === "complete" && (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      game.winner === "evil"
                        ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                        : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    }`}
                  >
                    Game over.{" "}
                    {game.winner === "evil" ? "Evil wins!" : "Good wins!"}
                    <span className="mt-2 block text-xs">
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
                    </span>
                    {game.assassination && (
                      <span className="block text-xs">
                        Assassination{" "}
                        {game.assassination.success ? "succeeded" : "failed"}.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
