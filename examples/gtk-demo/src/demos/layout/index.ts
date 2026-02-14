import type { Demo } from "../types.js";
import { fixedDemo } from "./fixed.js";
import { fixed2Demo } from "./fixed2.js";
import { flowboxDemo } from "./flowbox.js";
import { headerbarDemo } from "./headerbar.js";
import { overlayDemo } from "./overlay.js";
import { overlayDecorativeDemo } from "./overlay-decorative.js";
import { panesDemo } from "./panes.js";
import { sizegroupDemo } from "./sizegroup.js";

export const layoutDemos: Demo[] = [
    panesDemo,
    fixedDemo,
    fixed2Demo,
    flowboxDemo,
    headerbarDemo,
    overlayDemo,
    overlayDecorativeDemo,
    sizegroupDemo,
];
