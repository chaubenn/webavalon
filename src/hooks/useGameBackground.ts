"use client";

import { useEffect } from "react";

const CLASS_NAME = "game-in-play";

/** Swaps body background to in-game art; landing/lobby keep parchment via default body styles. */
export function useGameBackground(active: boolean) {
  useEffect(() => {
    if (active) {
      document.body.classList.add(CLASS_NAME);
    } else {
      document.body.classList.remove(CLASS_NAME);
    }
    return () => document.body.classList.remove(CLASS_NAME);
  }, [active]);
}
