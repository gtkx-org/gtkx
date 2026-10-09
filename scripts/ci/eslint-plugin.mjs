import { createNodes as inferNodes } from "@nx/eslint/plugin";
import { wrapPlugin } from "./wrap-plugin.mjs";

export const createNodes = wrapPlugin(inferNodes);
export const createNodesV2 = createNodes;
