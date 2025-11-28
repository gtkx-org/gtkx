import type { Demo } from "../types.js";
import { boxDemo } from "./box.js";
import { centerBoxDemo } from "./center-box.js";
import { framesDemo } from "./frames.js";
import { panesDemo } from "./panes.js";

export const layoutDemos: Demo[] = [boxDemo, centerBoxDemo, panesDemo, framesDemo];
