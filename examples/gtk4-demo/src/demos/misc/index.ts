import type { Demo } from "../types.js";
import { browserDemo } from "./browser.js";
import { clipboardDemo } from "./clipboard.js";

export const miscDemos: Demo[] = [browserDemo, clipboardDemo];
