import type { Demo } from "../types.js";
import { constraintsDemo } from "./constraints.js";
import { constraintsInteractiveDemo } from "./constraints-interactive.js";
import { constraintsVflDemo } from "./constraints-vfl.js";

export const constraintsDemos: Demo[] = [
    constraintsDemo,
    constraintsInteractiveDemo,
    constraintsVflDemo,
];
