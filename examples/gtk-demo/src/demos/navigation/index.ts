import type { Demo } from "../types.js";
import { revealerDemo } from "./revealer.js";
import { sidebarDemo } from "./sidebar.js";
import { stackDemo } from "./stack.js";

export const navigationDemos: Demo[] = [stackDemo, revealerDemo, sidebarDemo];
