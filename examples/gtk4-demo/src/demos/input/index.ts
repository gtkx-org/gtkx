import type { Demo } from "../types.js";
import { entryDemo } from "./entry.js";
import { passwordEntryDemo } from "./password-entry.js";
import { scaleDemo } from "./scale.js";
import { searchEntryDemo } from "./search-entry.js";
import { spinButtonDemo } from "./spin-button.js";
import { textViewDemo } from "./text-view.js";

export const inputDemos: Demo[] = [
    entryDemo,
    passwordEntryDemo,
    searchEntryDemo,
    spinButtonDemo,
    scaleDemo,
    textViewDemo,
];
