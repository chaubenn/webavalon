import { getMissionTeamSize } from "@/lib/game";
import type { GamePublicView, PlayerSlot } from "@/lib/api";

type MissionBoardProps = {
  players: PlayerSlot[];
  game: GamePublicView;
};

export function MissionBoard({ players, game }: MissionBoardProps) {
  const playerMap = new Map(players.map((player) => [player.id, player.name]));
  const missions = Array.from({ length: 5 }, (_, index) => index);

  const historyByIndex = new Map(
    game.history.map((mission) => [mission.index, mission])
  );
  const winningMissionIndex =
    game.winner && game.history.length
      ? game.history[game.history.length - 1].index
      : null;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-white">Mission board</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {missions.map((missionIndex) => {
          const history = historyByIndex.get(missionIndex);
          const ladyUse = game.ladyUses.find(
            (entry) => entry.missionIndex === missionIndex
          );
          const isCurrent = missionIndex === game.missionIndex;
          const teamIds = history?.teamIds ?? (isCurrent ? game.currentTeamIds : []);
          const teamNames = teamIds.map((id) => playerMap.get(id) || "Unknown");
          const teamSize = getMissionTeamSize(players.length, missionIndex);
          const resultLabel =
            history?.success === true
              ? "Success"
              : history?.success === false
                ? "Fail"
                : isCurrent
                  ? teamIds.length === 0
                    ? "Awaiting team"
                    : game.phase === "mission_vote"
                      ? "Mission vote"
                      : "In progress"
                  : "Pending";
          const isWin = winningMissionIndex === missionIndex;
          const cardTone =
            history?.success === true
              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
              : history?.success === false
                ? "border-rose-400/50 bg-rose-500/15 text-rose-100"
                : isCurrent
                  ? "border-indigo-400/40 bg-indigo-500/10"
                  : "border-white/10 bg-black/30";

          return (
            <div
              key={missionIndex}
              className={`relative rounded-2xl border p-4 ${cardTone}`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 font-semibold text-white">
                  Mission {missionIndex + 1}
                  {isWin && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-200">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
                        <path
                          d="M4 7l4 4 4-6 4 6 4-4v9H4V7z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="text-xs text-white/60">
                  Team size {teamSize}
                </span>
              </div>
              <div className="mt-2 text-xs text-white/60">{resultLabel}</div>
              {ladyUse && (
                <div className="mt-2 rounded-xl border border-indigo-300/25 bg-indigo-500/10 px-2.5 py-2 text-xs text-indigo-100">
                  Lady used by{" "}
                  <span className="font-semibold">
                    {playerMap.get(ladyUse.viewerId) || "Unknown"}
                  </span>{" "}
                  on{" "}
                  <span className="font-semibold">
                    {playerMap.get(ladyUse.targetId) || "Unknown"}
                  </span>
                  .
                </div>
              )}
              {teamNames.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {teamNames.map((name, index) => (
                    <span
                      key={`${name}-${index}`}
                      className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/70"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
