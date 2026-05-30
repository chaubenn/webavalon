// Central manifest of generated UI/board art. Components reference these paths
// and fall back gracefully (CSS or onError) when a file is not present yet, so
// dropping a new asset into /public makes it appear with no code change.
export const UI_ASSETS = {
  pageBackground: "/ui/parchment-bg.webp",
  gameBackground: "/ui/game-castle-hall-bg.webp",
  crest: "/crest.webp",
  questSuccess: "/ui/quest-success.webp",
  questFail: "/ui/quest-fail.webp",
  ladyPortrait: "/ui/lady-of-the-lake.webp",
  lakeBackdrop: "/ui/lake-bg.webp",
  captainSeal: "/ui/captain-seal.webp",
  victoryHero: "/ui/victory.webp",
  defeatHero: "/ui/defeat.webp",
  waxSeal: "/ui/wax-seal.webp"
} as const;

export type UiAssetKey = keyof typeof UI_ASSETS;
