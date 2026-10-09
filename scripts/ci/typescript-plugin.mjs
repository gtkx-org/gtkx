import { createNodes as inferNodes } from "@nx/js/typescript";
import { wrapPlugin } from "./wrap-plugin.mjs";

export { createDependencies } from "@nx/js/typescript";
export const createNodes = wrapPlugin(inferNodes);
export const createNodesV2 = createNodes;
