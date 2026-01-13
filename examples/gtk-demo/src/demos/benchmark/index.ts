import type { Demo } from "../types.js";
import { framesDemo } from "./frames.js";
import { scrollingDemo } from "./scrolling.js";
import { themesDemo } from "./themes.js";

export const benchmarkDemos: Demo[] = [framesDemo, scrollingDemo, themesDemo];
