import { createNodes as inferNodes } from "@nx/oxlint";
import { wrapPlugin } from "./wrap-plugin.mjs";

export { createDependencies } from "@nx/oxlint";
export const createNodes = wrapPlugin(inferNodes);
export const createNodesV2 = createNodes;
