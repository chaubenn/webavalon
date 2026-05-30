export const MISSION_TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5]
};

export function getMissionTeamSize(
  playerCount: number,
  missionIndex: number
): number {
  return MISSION_TEAM_SIZES[playerCount]?.[missionIndex] ?? 0;
}

export function getFailsRequired(
  playerCount: number,
  missionIndex: number
): number {
  if (playerCount >= 7 && missionIndex === 3) {
    return 2;
  }
  return 1;
}
