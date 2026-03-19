"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { TogglePill } from "@/components/TogglePill";
import { createLobby } from "@/lib/api";
import { buildRoleConfig, ROLE_DEFINITIONS } from "@/lib/roles";
import { saveHostSecret, saveHostSlotId, savePlayerToken } from "@/lib/storage";

const MAX_TOTAL_PLAYERS = 10;
const MIN_OTHER_PLAYERS = 4;

export default function Home() {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [lobbyName, setLobbyName] = useState("");
  const [playerNames, setPlayerNames] = useState<string[]>(
    Array.from({ length: MIN_OTHER_PLAYERS }, () => "")
  );
  const [options, setOptions] = useState({
    percival: false,
    morgana: false,
    mordred: false,
    oberon: false
  });
  const [ladyEnabled, setLadyEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const totalPlayers = playerNames.length + 1;

  useEffect(() => {
    setError(null);
  }, [hostName, lobbyName, playerNames, options, ladyEnabled]);

  const roleConfig = useMemo(() => {
    return buildRoleConfig(totalPlayers, options);
  }, [totalPlayers, options]);

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

  const updatePlayer = (index: number, value: string) => {
    const next = [...playerNames];
    next[index] = value;
    setPlayerNames(next);
  };

  const addPlayer = () => {
    if (totalPlayers >= MAX_TOTAL_PLAYERS) return;
    setPlayerNames([...playerNames, ""]);
  };

  const removePlayer = (index: number) => {
    if (playerNames.length <= MIN_OTHER_PLAYERS) return;
    setPlayerNames(playerNames.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    setError(null);
    const trimmedNames = playerNames.map((name) => name.trim());
    const trimmedHost = hostName.trim();
    if (!trimmedHost) {
      setError("Please enter your name as host.");
      return;
    }
    if (trimmedNames.some((name) => !name)) {
      setError("Please fill in every player name.");
      return;
    }
    const duplicate = findDuplicate([trimmedHost, ...trimmedNames]);
    if (duplicate) {
      setError(`Duplicate player name: ${duplicate}`);
      return;
    }
    if (roleConfig.errors.length) {
      setError(roleConfig.errors.join(" "));
      return;
    }

    try {
      setLoading(true);
      const response = await createLobby({
        hostName: trimmedHost,
        lobbyName: lobbyName.trim() || undefined,
        playerNames: trimmedNames,
        roles: roleConfig.roles,
        ladyEnabled
      });
      saveHostSecret(response.lobbyCode, response.hostSecret);
      savePlayerToken(response.lobbyCode, response.hostPlayerToken);
      saveHostSlotId(response.lobbyCode, response.hostSlotId);
      router.push(`/host/${response.lobbyCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create lobby.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0b12]">
      <header className="px-6 pt-10 md:px-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300/70">
            Avalon Night
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Host Avalon with zero setup.
          </h1>
          <p className="max-w-xl text-sm text-white/60 md:text-base">
            Create a lobby, share the magic link, and hand phones around for
            private roles. No logins, no downloads.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10 md:flex-row md:items-start md:gap-8 md:px-10">
        <Card className="flex-1 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Create a lobby</h2>
            <p className="text-sm text-white/60">
              Add all players and optional roles. Merlin and Assassin are always
              included.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Your name (host)
            </label>
            <Input
              value={hostName}
              onChange={(event) => setHostName(event.target.value)}
              placeholder="Alex"
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Lobby name (optional)
            </label>
            <Input
              value={lobbyName}
              onChange={(event) => setLobbyName(event.target.value)}
              placeholder="Friday Night Avalon"
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Other players ({playerNames.length})
            </label>
            <div className="space-y-2">
              {playerNames.map((name, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(event) => updatePlayer(index, event.target.value)}
                    placeholder={`Player ${index + 1}`}
                  />
                  {playerNames.length > MIN_OTHER_PLAYERS && (
                    <button
                      type="button"
                      onClick={() => removePlayer(index)}
                      className="text-xs font-semibold text-white/40 hover:text-white"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addPlayer}
                disabled={totalPlayers >= MAX_TOTAL_PLAYERS}
              >
                Add player
              </Button>
              <span className="text-xs text-white/40">
                Total {totalPlayers}/{MAX_TOTAL_PLAYERS} players
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Special roles
            </label>
            <div className="flex flex-wrap gap-2">
              <TogglePill
                active={options.percival}
                label="Percival"
                onClick={() =>
                  setOptions((prev) => ({ ...prev, percival: !prev.percival }))
                }
              />
              <TogglePill
                active={options.morgana}
                label="Morgana"
                onClick={() =>
                  setOptions((prev) => ({ ...prev, morgana: !prev.morgana }))
                }
              />
              <TogglePill
                active={options.mordred}
                label="Mordred"
                onClick={() =>
                  setOptions((prev) => ({ ...prev, mordred: !prev.mordred }))
                }
              />
              <TogglePill
                active={options.oberon}
                label="Oberon"
                onClick={() =>
                  setOptions((prev) => ({ ...prev, oberon: !prev.oberon }))
                }
              />
            </div>
          </div>

          <div className="space-y-3">
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

          <div className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4">
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

          {error && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create lobby"}
          </Button>
        </Card>

        <div className="flex w-full flex-col gap-6 md:w-[320px]">
          <Card className="space-y-4">
            <h3 className="text-base font-semibold text-white">Join a lobby</h3>
            <p className="text-sm text-white/60">
              Enter a lobby code if someone shared it verbally.
            </p>
            <Input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABCDE"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (joinCode.trim()) {
                  router.push(`/join/${joinCode.trim()}`);
                }
              }}
            >
              Open lobby
            </Button>
          </Card>

          <Card className="space-y-3">
            <h3 className="text-base font-semibold text-white">
              Phone-friendly flow
            </h3>
            <ul className="space-y-2 text-sm text-white/60">
              <li>• Private role reveal per player</li>
              <li>• Auto rejoin on refresh</li>
              <li>• Built for in-person play</li>
            </ul>
          </Card>
        </div>
      </main>
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
