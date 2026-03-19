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

  const roleConfig = useMemo(
    () => buildRoleConfig(totalPlayers, options),
    [totalPlayers, options]
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
      setError("Enter your name to summon the council.");
      return;
    }
    if (trimmedNames.some((name) => !name)) {
      setError("All knights must be named before the council is summoned.");
      return;
    }
    const duplicate = findDuplicate([trimmedHost, ...trimmedNames]);
    if (duplicate) {
      setError(`Two knights share the name "${duplicate}". Names must be unique.`);
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
      setError(
        err instanceof Error ? err.message : "The council could not be summoned."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#07090d]">
      {/* Header */}
      <header className="relative px-6 pt-12 pb-2 md:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <p className="font-display text-xs tracking-[0.35em] uppercase text-[var(--gold-dim)] mb-3">
            ✦ &nbsp; Avalon Night &nbsp; ✦
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight text-[var(--foreground)] md:text-5xl">
            Gather your knights.
            <br />
            <span className="gold-shimmer-text">Unmask the traitors.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base text-[var(--parchment-dim)]">
            Summon a secret council, share the seal of entry, and pass phones
            around for private role reveals. No scrolls, no oaths — just
            deception.
          </p>
          <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-[var(--gold-dim)] to-transparent opacity-40" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8 md:flex-row md:items-start md:gap-8 md:px-10">
        {/* Create lobby */}
        <Card className="flex-1 space-y-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
              Summon a Council
            </h2>
            <p className="mt-1 text-sm text-[var(--parchment-dim)]">
              Merlin and the Assassin are always present. Add your knights and
              choose which shadows to invite.
            </p>
          </div>

          <div className="space-y-2">
            <label className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
              Your Name
            </label>
            <Input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Lord Percival"
            />
          </div>

          <div className="space-y-2">
            <label className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
              Council Name{" "}
              <span className="normal-case tracking-normal text-[var(--parchment-dim)]/60">
                (optional)
              </span>
            </label>
            <Input
              value={lobbyName}
              onChange={(e) => setLobbyName(e.target.value)}
              placeholder="The Round Table"
            />
          </div>

          <div className="space-y-2">
            <label className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
              Fellow Knights ({playerNames.length})
            </label>
            <div className="space-y-2">
              {playerNames.map((name, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(e) => updatePlayer(index, e.target.value)}
                    placeholder={`Knight ${index + 1}`}
                  />
                  {playerNames.length > MIN_OTHER_PLAYERS && (
                    <button
                      type="button"
                      onClick={() => removePlayer(index)}
                      className="font-display text-xs tracking-wide text-[var(--parchment-dim)]/50 hover:text-[var(--crimson-bright)] transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={addPlayer}
                disabled={totalPlayers >= MAX_TOTAL_PLAYERS}
              >
                + Add knight
              </Button>
              <span className="text-xs text-[var(--parchment-dim)]/60">
                {totalPlayers}/{MAX_TOTAL_PLAYERS} at the table
              </span>
            </div>
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
                  active={options[key]}
                  label={label}
                  onClick={() =>
                    setOptions((prev) => ({ ...prev, [key]: !prev[key] }))
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

          {/* Role mix */}
          <div className="rounded-xl border border-[rgba(201,168,76,0.15)] bg-[#07090d] p-4 space-y-1">
            <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">
              Council Composition
            </p>
            <p className="text-sm text-[var(--foreground)]">
              {roleSummary.length ? roleSummary.join(" · ") : "—"}
            </p>
            {roleConfig.errors.length > 0 && (
              <p className="text-xs text-[var(--crimson-bright)] mt-1">
                {roleConfig.errors.join(" ")}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-[rgba(155,32,32,0.4)] bg-[rgba(107,18,18,0.3)] px-4 py-3 text-sm text-[var(--crimson-bright)]">
              {error}
            </div>
          )}

          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? "Summoning the council…" : "Assemble the Council"}
          </Button>
        </Card>

        {/* Sidebar */}
        <div className="flex w-full flex-col gap-5 md:w-[300px]">
          <Card className="space-y-4">
            <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
              Enter the Keep
            </h3>
            <p className="text-sm text-[var(--parchment-dim)]">
              Speak the code if your liege shared it by word of mouth.
            </p>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCDE"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (joinCode.trim()) router.push(`/join/${joinCode.trim()}`);
              }}
            >
              Cross the Bridge
            </Button>
          </Card>

          <Card className="space-y-3">
            <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
              The Ancient Rite
            </h3>
            <ul className="space-y-1.5 text-sm text-[var(--parchment-dim)]">
              <li className="flex items-start gap-2">
                <span className="text-[var(--gold-dim)] mt-0.5">✦</span>
                Private role reveal per knight
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--gold-dim)] mt-0.5">✦</span>
                Auto-rejoin on page refresh
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--gold-dim)] mt-0.5">✦</span>
                Forged for in-person councils
              </li>
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
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}
