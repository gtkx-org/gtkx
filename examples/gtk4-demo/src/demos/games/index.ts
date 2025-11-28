import type { Demo } from "../types.js";
import { fifteenPuzzleDemo } from "./fifteen-puzzle.js";
import { memoryGameDemo } from "./memory-game.js";
import { gamesPlaceholderDemo } from "./placeholder.js";

export const gamesDemos: Demo[] = [gamesPlaceholderDemo, fifteenPuzzleDemo, memoryGameDemo];
