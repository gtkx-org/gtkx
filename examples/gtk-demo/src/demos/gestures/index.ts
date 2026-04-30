import type { Demo } from "../types.js";
import { clipboardDemo } from "./clipboard.js";
import { cursorsDemo } from "./cursors.js";
import { dndDemo } from "./dnd.js";
import { gesturesDemo } from "./gestures.js";
import { linksDemo } from "./links.js";
import { shortcutTriggersDemo } from "./shortcut-triggers.js";

export const gesturesDemos: Demo[] = [
    gesturesDemo,
    dndDemo,
    clipboardDemo,
    shortcutTriggersDemo,
    linksDemo,
    cursorsDemo,
];
