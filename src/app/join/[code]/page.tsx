"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
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
import { PhaseBanner } from "@/components/ui/PhaseBanner";
import { CouncilBriefCard } from "@/components/game/CouncilBriefCard";
import { QuestTableHero } from "@/components/game/QuestTableHero";
import { useGameBackground } from "@/hooks/useGameBackground";
import { useTeamVoteReveal } from "@/hooks/useTeamVoteReveal";
import { UI_ASSETS } from "@/lib/assets";
import Image from "next/image";

/* ─── Overlays ─────────────────────────────────────────────────── */

function GameEndOverlay({
  game,
  onClose
}: {
  game: NonNullable<PlayerState["game"]>;
  onClose: () => void;
}) {
  const isGoodWin = game.winner === "good";
  const isMerlinSlain =
    game.winner === "evil" && game.assassination?.success === true;
  const isCouncilCollapsed =
    game.winner === "evil" && !game.assassination;

  let title = "";
  let subtitle = "";
  let glyph = "";
  let bgClass = "";
  let titleClass = "";

  if (isGoodWin) {
    title = "The Realm is Saved";
    subtitle = game.assassination?.success === false
      ? "Good triumphed — and the Assassin's blade found no true mark."
      : "Loyalty and truth have prevailed. Merlin's wisdom endures.";
    glyph = "♔";
    bgClass =
      "bg-gradient-to-b from-[#071a10] via-[#07090d] to-[#071a10]";
    titleClass = "text-[var(--realm-green-bright)]";
  } else if (isMerlinSlain) {
    title = "Merlin is Slain";
    subtitle =
      "The Assassin's blade found its true mark. Darkness claims the realm.";
    glyph = "⚔";
    bgClass =
      "bg-gradient-to-b from-[#1a0707] via-[#07090d] to-[#1a0707]";
    titleClass = "text-[var(--crimson-bright)]";
  } else if (isCouncilCollapsed) {
    title = "The Council Collapses";
    subtitle =
      "The fellowship was rejected five times. Evil prevails by treachery.";
    glyph = "✕";
    bgClass =
      "bg-gradient-to-b from-[#1a0707] via-[#07090d] to-[#1a0707]";
    titleClass = "text-[var(--crimson-bright)]";
  } else {
    title = "The Realm Falls to Shadow";
    subtitle = "Three quests were betrayed from within. Evil reigns.";
    glyph = "⚔";
    bgClass =
      "bg-gradient-to-b from-[#1a0707] via-[#07090d] to-[#1a0707]";
    titleClass = "text-[var(--crimson-bright)]";
  }

  const heroSrc = isGoodWin ? UI_ASSETS.victoryHero : UI_ASSETS.defeatHero;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-6 ${bgClass}`}
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <Image
          src={heroSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07090d]/70 via-[#07090d]/85 to-[#07090d]" />
      </div>
      <div className="animate-victory-rise relative flex max-w-md w-full flex-col items-center gap-6 text-center overflow-y-auto max-h-screen py-8">
        <div
          className={`text-7xl ${isGoodWin ? "text-[var(--gold)]" : "text-[var(--crimson-bright)]"}`}
          style={{ filter: `drop-shadow(0 0 24px ${isGoodWin ? "var(--gold)" : "var(--crimson-bright)"})` }}
        >
          {glyph}
        </div>

        <div className="space-y-2">
          <p className="font-display text-xs tracking-[0.35em] uppercase text-[var(--parchment-dim)]">
            — Game Over —
          </p>
          <h1 className={`font-display text-3xl font-semibold leading-tight ${titleClass}`}>
            {title}
          </h1>
          <p className="text-sm text-[var(--parchment-dim)] leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="flex gap-4 text-sm">
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-xs uppercase tracking-[0.2em] text-[var(--parchment-dim)]/60">
              Good
            </span>
            <span
              className={`font-display text-lg font-semibold ${
                isGoodWin
                  ? "text-[var(--realm-green-bright)]"
                  : "text-[var(--parchment-dim)]"
              }`}
            >
              {isGoodWin ? "VICTORY" : "DEFEAT"}
            </span>
          </div>
          <div className="w-px bg-[var(--gold-dim)]/30" />
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-xs uppercase tracking-[0.2em] text-[var(--parchment-dim)]/60">
              Evil
            </span>
            <span
              className={`font-display text-lg font-semibold ${
                !isGoodWin
                  ? "text-[var(--crimson-bright)]"
                  : "text-[var(--parchment-dim)]"
              }`}
            >
              {!isGoodWin ? "VICTORY" : "DEFEAT"}
            </span>
          </div>
        </div>

        {game.assassination && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              game.assassination.success
                ? "border-[rgba(155,32,32,0.4)] bg-[rgba(107,18,18,0.3)] text-[var(--crimson-bright)]"
                : "border-[rgba(42,122,74,0.4)] bg-[rgba(26,74,46,0.3)] text-[var(--realm-green-bright)]"
            }`}
          >
            Assassination {game.assassination.success ? "succeeded" : "failed"}
          </div>
        )}

        {/* Role reveal */}
        {game.roleReveal && game.roleReveal.length > 0 && (
          <div className="w-full space-y-2">
            <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)] text-center">
              All Roles Revealed
            </p>
            <div className="grid grid-cols-2 gap-2 w-full">
              {game.roleReveal.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                    entry.alignment === "good"
                      ? "border-[rgba(42,122,74,0.35)] bg-[rgba(26,74,46,0.4)]"
                      : "border-[rgba(155,32,32,0.35)] bg-[rgba(107,18,18,0.4)]"
                  }`}
                >
                  <span className="text-[var(--foreground)] truncate mr-2">
                    {entry.name}
                  </span>
                  <span
                    className={`shrink-0 font-display text-[0.65rem] tracking-wide ${
                      entry.alignment === "good"
                        ? "text-[var(--realm-green-bright)]"
                        : "text-[var(--crimson-bright)]"
                    }`}
                  >
                    {entry.roleName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--gold-dim)] to-transparent opacity-40" />
        <Button variant="outline" onClick={onClose}>
          Return to the Hall
        </Button>
      </div>
    </div>
  );
}

function LakedOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #0e2a4a 0%, #07090d 70%)"
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <Image
          src={UI_ASSETS.lakeBackdrop}
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-20"
        />
      </div>
      <div className="animate-fade-in-scale relative flex max-w-sm w-full flex-col items-center gap-6 text-center">
        {/* Lady portrait with ripple rings */}
        <div className="relative flex h-32 w-32 items-center justify-center">
          <div
            className="absolute h-full w-full rounded-full border border-[var(--lady-blue-bright)]/30 animate-ripple-out"
            style={{ animationDelay: "0s" }}
          />
          <div
            className="absolute h-full w-full rounded-full border border-[var(--lady-blue-bright)]/20 animate-ripple-out"
            style={{ animationDelay: "0.6s" }}
          />
          <div
            className="absolute h-full w-full rounded-full border border-[var(--lady-blue-bright)]/10 animate-ripple-out"
            style={{ animationDelay: "1.2s" }}
          />
          <div
            className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-[var(--lady-blue-bright)]/50"
            style={{ filter: "drop-shadow(0 0 16px var(--lady-blue-bright))" }}
          >
            <Image
              src={UI_ASSETS.ladyPortrait}
              alt=""
              fill
              sizes="96px"
              className="object-cover object-top"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-display text-xs tracking-[0.35em] uppercase text-[var(--lady-blue-bright)]/70">
            — The Lake Stirs —
          </p>
          <h1 className="font-display text-2xl font-semibold text-[var(--foreground)]">
            The Lady of the Lake
            <br />
            Chooses You
          </h1>
          <p className="text-sm text-[var(--parchment-dim)] leading-relaxed">
            The ancient power passes into your hands. You may peer into the soul
            of another knight and reveal their true allegiance.
          </p>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--lady-blue-bright)] to-transparent opacity-30" />
        <Button variant="ghost" onClick={onClose}>
          I am ready
        </Button>
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */

export default function JoinLobbyPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code?.toUpperCase() ?? "";
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [ladyTarget, setLadyTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showGameEnd, setShowGameEnd] = useState(false);
  const shownGameEndRef = useRef(false);

  const [showLaked, setShowLaked] = useState(false);
  const prevLadyHolderRef = useRef<string | null | undefined>(undefined);

  const [ladyRevealVisible, setLadyRevealVisible] = useState(false);
  const ladyRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCaptainOrder, setShowCaptainOrder] = useState(false);

  useEffect(() => {
    getLobbyState(code)
      .then(setLobbyState)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Council not found.")
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
          const publicState = message.payload as LobbyState;
          setLobbyState(publicState);
          setPlayerState((prev) => {
            if (!prev || prev.gameState !== "lobby") return prev;
            return {
              ...prev,
              lobbyName: publicState.lobbyName,
              gameState: publicState.gameState,
              players: publicState.players,
              roleConfig: publicState.roleConfig,
              ladyEnabled: publicState.ladyEnabled
            };
          });
        }
        if (message.type === "player_state") {
          setPlayerState(message.payload as PlayerState);
        }
        if (message.type === "session_invalidated") {
          clearPlayerToken(code);
          setToken(null);
          setPlayerState(null);
        }
        if (message.type === "kicked") {
          clearPlayerToken(code);
          setToken(null);
          setPlayerState(null);
          router.push("/");
        }
        if (message.type === "lobby_deleted") {
          clearPlayerToken(code);
          setToken(null);
          setPlayerState(null);
          router.push("/");
        }
        if (message.type === "game_aborted") {
          setNotice("The quest has been recalled by the host.");
          shownGameEndRef.current = false;
        }
        if (message.type === "error") {
          setError(String(message.message ?? "A disturbance in the realm."));
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

  // Game end overlay detection
  const game = playerState?.game;
  const {
    teamVoteReveal,
    dismissTeamVoteReveal
  } = useTeamVoteReveal(game);

  useGameBackground(
    playerState?.gameState === "started" && Boolean(game)
  );

  useEffect(() => {
    if (game?.phase === "complete" && !shownGameEndRef.current) {
      shownGameEndRef.current = true;
      setShowGameEnd(true);
    }
  }, [game?.phase]);

  // Laked detection: holderId changes to current player
  useEffect(() => {
    const holderId = game?.lady.holderId;
    const playerId = playerState?.player.id;
    if (
      prevLadyHolderRef.current !== undefined &&
      holderId !== prevLadyHolderRef.current &&
      holderId === playerId
    ) {
      setShowLaked(true);
    }
    prevLadyHolderRef.current = holderId;
  }, [game?.lady.holderId, playerState?.player.id]);

  // Reset lady reveal when the target changes (new use)
  useEffect(() => {
    setLadyRevealVisible(false);
    if (ladyRevealTimerRef.current) clearTimeout(ladyRevealTimerRef.current);
  }, [game?.player?.ladyReveal?.targetId]);

  const handleLadyRevealTap = () => {
    if (ladyRevealTimerRef.current) clearTimeout(ladyRevealTimerRef.current);
    if (ladyRevealVisible) {
      setLadyRevealVisible(false);
      return;
    }
    setLadyRevealVisible(true);
    ladyRevealTimerRef.current = setTimeout(() => setLadyRevealVisible(false), 3000);
  };

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
      setError(err instanceof Error ? err.message : "Unable to claim your seat.");
    }
  };

  const displayName = playerState?.player.name ?? "Knight";
  const lobbyName = playerState?.lobbyName ?? lobbyState?.lobbyName;
  const players = playerState?.players ?? lobbyState?.players ?? [];
  const roleConfig =
    playerState?.roleConfig ?? lobbyState?.roleConfig ?? null;
  const ladyStatus =
    game?.lady.enabled ??
    playerState?.ladyEnabled ??
    lobbyState?.ladyEnabled ??
    false;

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p.name])),
    [players]
  );

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

  // Assassin's known evil teammates (by slotId) — used to disable them in assassination selector
  const evilTeammateMap = useMemo(() => {
    const map = new Map<string, string>(); // slotId → role tag
    if (!playerState?.knowledge) return map;
    for (const entry of playerState.knowledge) {
      map.set(entry.slotId, entry.tag);
    }
    return map;
  }, [playerState?.knowledge]);

  const roleSummary = useMemo(() => {
    if (!roleConfig) return [];
    const counts = new Map<string, number>();
    for (const role of roleConfig.roles) {
      const name = ROLE_DEFINITIONS[role].name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) =>
      count > 1 ? `${name} ×${count}` : name
    );
  }, [roleConfig]);

  if (!lobbyState && !playerState) {
    return (
      <div className="min-h-screen px-6 py-10 flex items-center justify-center">
        <Card variant="parchment" className="max-w-md text-center space-y-3">
          <div className="text-3xl text-[var(--gold-dim)] animate-pulse-soft">✦</div>
          <p className="font-display text-sm text-[var(--parchment-dim)]">
            Consulting the council…
          </p>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Overlays */}
      {showGameEnd && game && (
        <GameEndOverlay game={game} onClose={() => setShowGameEnd(false)} />
      )}
      {showLaked && <LakedOverlay onClose={() => setShowLaked(false)} />}
      <div className="min-h-screen px-6 py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">

          {/* Header */}
          <header className="space-y-2">
            <p className="font-display text-xs tracking-[0.3em] uppercase text-[var(--gold-dim)]">
              ✦ &nbsp; Council {code}
            </p>
            <h1 className="font-display text-2xl font-semibold text-[var(--foreground)]">
              {lobbyName || "Avalon Council"}
            </h1>
            {playerState && (
              <p className="text-sm text-[var(--parchment-dim)]">
                You ride as{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {displayName}
                </span>
              </p>
            )}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--gold-dim)] to-transparent opacity-30" />
          </header>

          {error && (
            <div className="rounded-xl border border-[rgba(155,32,32,0.4)] bg-[rgba(107,18,18,0.3)] px-4 py-3 text-sm text-[var(--crimson-bright)]">
              {error}
            </div>
          )}

          {notice && (
            <div className="rounded-xl border border-[rgba(201,168,76,0.3)] bg-[rgba(107,84,18,0.2)] px-4 py-3 text-sm text-[var(--gold)]">
              {notice}
            </div>
          )}

          {/* Council brief — lobby visitors without a seat */}
          {roleConfig && !playerState && (
            <Card className="space-y-2">
              <h2 className="font-display text-sm font-semibold text-[var(--foreground)]">
                Council Composition
              </h2>
              <p className="text-sm text-[var(--parchment-dim)]">
                {roleSummary.length ? roleSummary.join(" · ") : "Roles pending"}
              </p>
              <p className="text-xs text-[var(--parchment-dim)]/60">
                Lady of the Lake:{" "}
                <span className={ladyStatus ? "text-[var(--lady-blue-bright)]" : ""}>
                  {ladyStatus ? "Summoned" : "Absent"}
                </span>
              </p>
            </Card>
          )}

          {/* Unclaimed — choose your name */}
          {!playerState && lobbyState && (
            <Card className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                Claim Your Seat
              </h2>
              <p className="text-sm text-[var(--parchment-dim)]">
                Tap your name to take your place at the Round Table. Claimed
                seats are sealed.
              </p>
              {lobbyState.gameState === "started" && (
                <p className="text-sm text-[var(--gold)]">
                  The quest has already begun. Ask the host to release your seat
                  if you need to join.
                </p>
              )}
              <div className="space-y-2">
                {lobbyState.players.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    disabled={player.claimed}
                    onClick={() => handleClaim(player.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      player.claimed
                        ? "border-[rgba(201,168,76,0.1)] bg-[#07090d] text-[var(--parchment-dim)]/40"
                        : "border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.04)] text-[var(--foreground)] hover:border-[var(--gold)] hover:bg-[rgba(201,168,76,0.08)]"
                    }`}
                  >
                    <span className="font-display text-sm">{player.name}</span>
                    <span className="text-xs text-[var(--parchment-dim)]/60">
                      {player.claimed ? "Claimed" : "Tap to claim"}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Claimed player view */}
          {playerState && (
            <div className="space-y-5">
              {playerState.gameState === "lobby" && (
                <Card className="space-y-2 py-6 text-center">
                  <div className="text-3xl text-[var(--gold-dim)] animate-pulse-soft">✦</div>
                  <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                    Awaiting the King&apos;s Command
                  </h2>
                  <p className="text-sm text-[var(--parchment-dim)]">
                    Your role will be revealed once the quest begins.
                  </p>
                </Card>
              )}

              {roleConfig && (
                <CouncilBriefCard
                  roleSummary={roleSummary}
                  ladyEnabled={ladyStatus}
                  role={playerState.role}
                  knowledge={playerState.knowledge}
                  gameStarted={
                    playerState.gameState === "started" &&
                    Boolean(playerState.role)
                  }
                />
              )}

              {game && players.length > 0 && (
                <QuestTableHero
                  players={players}
                  game={game}
                  playerMap={playerMap}
                  showCaptainOrder={showCaptainOrder}
                  onToggleCaptainOrder={() => setShowCaptainOrder((v) => !v)}
                  teamVoteReveal={teamVoteReveal}
                  onDismissTeamVote={dismissTeamVoteReveal}
                >
                <div className="space-y-4">
                  {(() => {
                    const p = game.player;
                    let msg: string | null = null;
                    let tone: "gold" | "crimson" | "lady" = "gold";
                    if (game.phase === "team_select" && p.isCaptain) {
                      msg = "Your move, Captain — assemble the fellowship.";
                    } else if (game.phase === "team_vote" && !p.hasTeamVote) {
                      msg = "Cast your verdict on the proposed fellowship.";
                    } else if (
                      game.phase === "mission_vote" &&
                      p.isOnTeam &&
                      !p.hasMissionVote
                    ) {
                      msg = "The quest awaits — play your card in secret.";
                    } else if (
                      game.phase === "assassination" &&
                      playerState?.role?.id === "assassin"
                    ) {
                      msg = "Name the knight you believe is Merlin.";
                      tone = "crimson";
                    }
                    if (p.canUseLady) {
                      msg = "The Lady of the Lake awaits your gaze.";
                      tone = "lady";
                    }
                    return msg ? <PhaseBanner message={msg} tone={tone} /> : null;
                  })()}

                  {actionError && (
                    <div className="rounded-xl border border-[rgba(155,32,32,0.4)] bg-[rgba(107,18,18,0.3)] px-4 py-3 text-sm text-[var(--crimson-bright)]">
                      {actionError}
                    </div>
                  )}

                  {/* Lady reveal result — tap to show for 3 seconds */}
                  {game.player.ladyReveal && (
                    <div className="space-y-2">
                      <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--parchment-dim)]/70">
                        ◈ Lady Reveals
                      </p>
                      <p className="text-sm text-[var(--parchment-dim)]">
                        {playerMap.get(game.player.ladyReveal.targetId) ?? "That knight"}{" "}
                        is…
                      </p>
                      {ladyRevealVisible ? (
                        <button
                          type="button"
                          onClick={handleLadyRevealTap}
                          className={`w-full rounded-2xl border px-5 py-5 text-center animate-fade-in-scale ${
                            game.player.ladyReveal.alignment === "good"
                              ? "border-[rgba(42,122,74,0.5)] bg-[rgba(26,74,46,0.4)]"
                              : "border-[rgba(155,32,32,0.5)] bg-[rgba(107,18,18,0.4)]"
                          }`}
                        >
                          <p
                            className={`font-display text-4xl font-semibold tracking-widest ${
                              game.player.ladyReveal.alignment === "good"
                                ? "text-[var(--realm-green-bright)]"
                                : "text-[var(--crimson-bright)]"
                            }`}
                            style={{
                              filter: `drop-shadow(0 0 16px ${
                                game.player.ladyReveal.alignment === "good"
                                  ? "var(--realm-green-bright)"
                                  : "var(--crimson-bright)"
                              })`
                            }}
                          >
                            {game.player.ladyReveal.alignment.toUpperCase()}
                          </p>
                          <p className="mt-2 text-xs text-[var(--parchment-dim)]/50">
                            Tap to hide
                          </p>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleLadyRevealTap}
                          className="w-full rounded-2xl border border-[rgba(74,144,196,0.3)] bg-[rgba(14,26,46,0.5)] px-5 py-4 text-sm text-[var(--lady-blue-bright)] hover:bg-[rgba(14,26,46,0.8)] transition"
                        >
                          ◈ Tap to reveal their allegiance
                        </button>
                      )}
                    </div>
                  )}

                  {/* Phase: team_select */}
                  {game.phase === "team_select" && (
                    <div className="space-y-3">
                      {game.player.isCaptain ? (
                        <>
                          <p className="font-display text-sm text-[var(--gold)]">
                            You are the Captain — choose{" "}
                            {game.missionSize} knights for Quest{" "}
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
                                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all ${
                                    isSelected
                                      ? "border-[var(--gold)] bg-[rgba(201,168,76,0.1)] text-[var(--foreground)]"
                                      : "border-[rgba(201,168,76,0.15)] bg-[#07090d] text-[var(--parchment-dim)] hover:border-[rgba(201,168,76,0.3)]"
                                  }`}
                                >
                                  <span>{player.name}</span>
                                  <span className="text-xs text-[var(--parchment-dim)]/60">
                                    {isSelected ? "Selected ✦" : "Tap to choose"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <Button
                            onClick={async () => {
                              if (!token) return;
                              setActionError(null);
                              try {
                                await selectTeam(code, token, selectedTeam);
                              } catch (err) {
                                setActionError(
                                  err instanceof Error
                                    ? err.message
                                    : "Unable to assemble the team."
                                );
                              }
                            }}
                            disabled={selectedTeam.length !== game.missionSize}
                            className="w-full"
                          >
                            Dispatch the Fellowship
                          </Button>
                        </>
                      ) : (
                        <p className="text-sm text-[var(--parchment-dim)] italic">
                          The Captain deliberates… await your summons.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Phase: team_vote */}
                  {game.phase === "team_vote" && (
                    <div className="space-y-3">
                      <p className="font-display text-sm text-[var(--gold)]">
                        Approve or reject the proposed fellowship.
                      </p>
                      {!game.player.hasTeamVote ? (
                        <div className="flex gap-3">
                          <Button
                            className="flex-1"
                            onClick={async () => {
                              if (!token) return;
                              setActionError(null);
                              try {
                                await submitTeamVote(code, token, "approve");
                              } catch (err) {
                                setActionError(
                                  err instanceof Error ? err.message : "Vote failed."
                                );
                              }
                            }}
                          >
                            Approve ✦
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 border-[rgba(155,32,32,0.45)] text-[var(--crimson-bright)] hover:bg-[rgba(107,18,18,0.2)]"
                            onClick={async () => {
                              if (!token) return;
                              setActionError(null);
                              try {
                                await submitTeamVote(code, token, "reject");
                              } catch (err) {
                                setActionError(
                                  err instanceof Error ? err.message : "Vote failed."
                                );
                              }
                            }}
                          >
                            Reject ⚔
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--parchment-dim)] italic">
                          Your vote is cast. Awaiting the others…
                        </p>
                      )}
                    </div>
                  )}

                  {/* Phase: mission_vote */}
                  {game.phase === "mission_vote" && (
                    <div className="space-y-3">
                      {game.player.isOnTeam ? (
                        <>
                          <p className="font-display text-sm text-[var(--gold)]">
                            The quest begins. Submit your card in secret.
                          </p>
                          {!game.player.hasMissionVote ? (
                            <div className="flex gap-3">
                              <Button
                                className="flex-1"
                                onClick={async () => {
                                  if (!token) return;
                                  setActionError(null);
                                  try {
                                    await submitMissionVote(
                                      code,
                                      token,
                                      "success"
                                    );
                                  } catch (err) {
                                    setActionError(
                                      err instanceof Error
                                        ? err.message
                                        : "Vote failed."
                                    );
                                  }
                                }}
                              >
                                Success ✦
                              </Button>
                              <Button
                                variant="outline"
                                disabled={!game.player.canFail}
                                className="flex-1 border-[rgba(155,32,32,0.45)] text-[var(--crimson-bright)] hover:bg-[rgba(107,18,18,0.2)] disabled:border-[rgba(201,168,76,0.1)] disabled:text-[var(--parchment-dim)]/30"
                                onClick={async () => {
                                  if (!token) return;
                                  setActionError(null);
                                  try {
                                    await submitMissionVote(
                                      code,
                                      token,
                                      "fail"
                                    );
                                  } catch (err) {
                                    setActionError(
                                      err instanceof Error
                                        ? err.message
                                        : "Vote failed."
                                    );
                                  }
                                }}
                              >
                                Betray ⚔
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm text-[var(--parchment-dim)] italic">
                              Your card is placed. Awaiting the fellowship…
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-[var(--parchment-dim)] italic">
                          The quest is underway. The fellowship votes in secret.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Lady of the Lake */}
                  {game.lady.enabled && game.lady.holderId && (
                    <div className="rounded-2xl border border-[rgba(74,144,196,0.25)] bg-[rgba(14,26,46,0.6)] p-4 text-sm">
                      {game.lady.holderId === playerState?.player.id ? (
                        <div className="space-y-3">
                          <p className="font-display text-sm font-semibold text-[var(--lady-blue-bright)]">
                            ◈ You hold the Lady of the Lake
                          </p>
                          <p className="text-xs text-[var(--parchment-dim)]/70">
                            Available from Quest{" "}
                            {game.player.ladyAvailableFrom + 1}. Use once per
                            quest.
                          </p>
                          {game.player.canUseLady && (
                            <>
                              <div className="grid gap-2">
                                {players
                                  .filter(
                                    (p) => p.id !== game.lady.holderId
                                  )
                                  .map((player) => (
                                    <button
                                      key={player.id}
                                      type="button"
                                      onClick={() =>
                                        setLadyTarget(player.id)
                                      }
                                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all ${
                                        ladyTarget === player.id
                                          ? "border-[var(--lady-blue-bright)] bg-[rgba(74,144,196,0.15)] text-[var(--foreground)]"
                                          : "border-[rgba(74,144,196,0.15)] bg-[#07090d] text-[var(--parchment-dim)] hover:border-[rgba(74,144,196,0.3)]"
                                      }`}
                                    >
                                      <span>{player.name}</span>
                                      <span className="text-xs text-[var(--parchment-dim)]/60">
                                        {ladyTarget === player.id
                                          ? "Chosen ◈"
                                          : "Tap to choose"}
                                      </span>
                                    </button>
                                  ))}
                              </div>
                              <Button
                                disabled={!ladyTarget || !token}
                                className="w-full bg-[var(--lady-blue-light)] text-white hover:bg-[var(--lady-blue-bright)] shadow-[0_0_20px_rgba(74,144,196,0.3)]"
                                onClick={async () => {
                                  if (!token || !ladyTarget) return;
                                  setActionError(null);
                                  try {
                                    await useLady(code, token, ladyTarget);
                                  } catch (err) {
                                    setActionError(
                                      err instanceof Error
                                        ? err.message
                                        : "The Lady refused."
                                    );
                                  }
                                }}
                              >
                                Reveal Allegiance
                              </Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <p className="text-[var(--lady-blue-bright)]/80">
                          ◈ Lady of the Lake held by{" "}
                          <span className="font-semibold text-[var(--lady-blue-bright)]">
                            {playerMap.get(game.lady.holderId) ?? "a knight"}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Phase: assassination */}
                  {game.phase === "assassination" && (
                    <div className="space-y-3">
                      {playerState?.role?.id === "assassin" ? (
                        <>
                          <div className="rounded-2xl border border-[rgba(155,32,32,0.4)] bg-[rgba(107,18,18,0.2)] p-4 space-y-1">
                            <p className="font-display text-sm font-semibold text-[var(--crimson-bright)]">
                              ⚔ The Assassination
                            </p>
                            <p className="text-sm text-[var(--parchment-dim)]">
                              Good has won three quests. Name the knight you
                              believe is Merlin — and claim victory for the
                              darkness.
                            </p>
                          </div>
                          <div className="grid gap-2">
                            {players.map((player) => {
                              const isYou = player.id === playerState?.player.id;
                              const teammateRole = evilTeammateMap.get(player.id);
                              const isTeammate = Boolean(teammateRole);
                              const isDisabled = isYou || isTeammate;
                              return (
                                <button
                                  key={player.id}
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() => {
                                    if (!isDisabled) setLadyTarget(player.id);
                                  }}
                                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all ${
                                    isDisabled
                                      ? "border-[rgba(201,168,76,0.1)] bg-[#07090d]/60 cursor-not-allowed opacity-60"
                                      : ladyTarget === player.id
                                        ? "border-[var(--crimson-bright)] bg-[rgba(155,32,32,0.15)] text-[var(--foreground)]"
                                        : "border-[rgba(155,32,32,0.15)] bg-[#07090d] text-[var(--parchment-dim)] hover:border-[rgba(155,32,32,0.3)]"
                                  }`}
                                >
                                  <span>{player.name}</span>
                                  <span
                                    className={`text-xs ${
                                      isTeammate
                                        ? "text-[var(--crimson-bright)]/70"
                                        : isYou
                                          ? "text-[var(--parchment-dim)]/40"
                                          : "text-[var(--parchment-dim)]/60"
                                    }`}
                                  >
                                    {isTeammate
                                      ? `${teammateRole} — your ally`
                                      : isYou
                                        ? "You"
                                        : ladyTarget === player.id
                                          ? "Marked ⚔"
                                          : "Tap to mark"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <Button
                            disabled={!ladyTarget || !token}
                            className="w-full bg-[var(--crimson)] border border-[rgba(155,32,32,0.5)] text-[var(--crimson-bright)] hover:bg-[var(--crimson-light)] shadow-[0_0_20px_rgba(155,32,32,0.3)]"
                            onClick={async () => {
                              if (!token || !ladyTarget) return;
                              setActionError(null);
                              try {
                                await assassinate(code, token, ladyTarget);
                              } catch (err) {
                                setActionError(
                                  err instanceof Error
                                    ? err.message
                                    : "The assassination failed."
                                );
                              }
                            }}
                          >
                            Strike — Confirm Assassination
                          </Button>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-[rgba(155,32,32,0.25)] bg-[rgba(107,18,18,0.15)] px-4 py-4 text-sm text-[var(--parchment-dim)] italic">
                          The Assassin deliberates in shadow…
                        </div>
                      )}
                    </div>
                  )}

                  {/* Phase: complete */}
                  {game.phase === "complete" && (
                    <div
                      className={`rounded-2xl border px-5 py-4 text-center space-y-2 ${
                        game.winner === "good"
                          ? "border-[rgba(42,122,74,0.4)] bg-[rgba(26,74,46,0.3)]"
                          : "border-[rgba(155,32,32,0.4)] bg-[rgba(107,18,18,0.3)]"
                      }`}
                    >
                      <p
                        className={`font-display text-lg font-semibold ${
                          game.winner === "good"
                            ? "text-[var(--realm-green-bright)]"
                            : "text-[var(--crimson-bright)]"
                        }`}
                      >
                        {game.winner === "good"
                          ? "The Realm is Saved"
                          : "The Realm Falls to Shadow"}
                      </p>
                      <p className="text-xs text-[var(--parchment-dim)]">
                        <span className={game.winner === "good" ? "text-[var(--realm-green-bright)]" : "text-[var(--parchment-dim)]"}>
                          Good: {game.winner === "good" ? "VICTORY" : "DEFEAT"}
                        </span>
                        {" · "}
                        <span className={game.winner === "evil" ? "text-[var(--crimson-bright)]" : "text-[var(--parchment-dim)]"}>
                          Evil: {game.winner === "evil" ? "VICTORY" : "DEFEAT"}
                        </span>
                      </p>
                      {game.assassination && (
                        <p className="text-xs text-[var(--parchment-dim)]/70">
                          Assassination{" "}
                          {game.assassination.success ? "succeeded" : "failed"}
                        </p>
                      )}
                      {/* Role reveal grid */}
                      {game.roleReveal && game.roleReveal.length > 0 && (
                        <div className="text-left space-y-2 pt-2">
                          <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
                            Roles Revealed
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {game.roleReveal.map((entry) => (
                              <div
                                key={entry.id}
                                className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs ${
                                  entry.alignment === "good"
                                    ? "border-[rgba(42,122,74,0.3)] bg-[rgba(26,74,46,0.3)]"
                                    : "border-[rgba(155,32,32,0.3)] bg-[rgba(107,18,18,0.3)]"
                                }`}
                              >
                                <span className="text-[var(--foreground)] truncate mr-2">
                                  {entry.name}
                                </span>
                                <span
                                  className={`shrink-0 font-display text-[0.65rem] ${
                                    entry.alignment === "good"
                                      ? "text-[var(--realm-green-bright)]"
                                      : "text-[var(--crimson-bright)]"
                                  }`}
                                >
                                  {entry.roleName}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="text-xs font-display text-[var(--gold-dim)] hover:text-[var(--gold)] underline underline-offset-2 transition"
                        onClick={() => setShowGameEnd(true)}
                      >
                        View full result
                      </button>
                    </div>
                  )}
                </div>
                </QuestTableHero>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
