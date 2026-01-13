import type { Demo } from "../types.js";
import { aspectFrameDemo } from "./aspectframe.js";
import { fixedDemo } from "./fixed.js";
import { fixed2Demo } from "./fixed2.js";
import { flowboxDemo } from "./flowbox.js";
import { headerbarDemo } from "./headerbar.js";
import { layoutManagerDemo } from "./layoutmanager.js";
import { layoutManager2Demo } from "./layoutmanager2.js";
import { overlayDemo } from "./overlay.js";
import { overlayDecorativeDemo } from "./overlay-decorative.js";
import { panedDemo } from "./paned.js";
import { sizegroupDemo } from "./sizegroup.js";

export const layoutDemos: Demo[] = [
    aspectFrameDemo,
    panedDemo,
    fixedDemo,
    fixed2Demo,
    flowboxDemo,
    headerbarDemo,
    overlayDemo,
    overlayDecorativeDemo,
    sizegroupDemo,
    layoutManagerDemo,
    layoutManager2Demo,
];
