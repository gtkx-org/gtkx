import type { Demo } from "../types.js";
import { entryUndoDemo } from "./entry-undo.js";
import { hypertextDemo } from "./hypertext.js";
import { passwordEntryDemo } from "./password-entry.js";
import { readMoreDemo } from "./read-more.js";
import { searchEntryDemo } from "./search-entry.js";
import { tabsDemo } from "./tabs.js";
import { taggedEntryDemo } from "./tagged-entry.js";
import { textscrollDemo } from "./textscroll.js";
import { textundoDemo } from "./textundo.js";
import { textviewDemo } from "./textview.js";

export const inputDemos: Demo[] = [
    entryUndoDemo,
    passwordEntryDemo,
    searchEntryDemo,
    tabsDemo,
    taggedEntryDemo,
    textviewDemo,
    hypertextDemo,
    textscrollDemo,
    textundoDemo,
    readMoreDemo,
];
