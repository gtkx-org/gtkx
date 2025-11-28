import type { Demo } from "../types.js";
import { imageDemo } from "./image.js";
import { levelBarDemo } from "./levelbar.js";
import { progressBarDemo } from "./progressbar.js";
import { spinnerDemo } from "./spinner.js";

export const displayDemos: Demo[] = [spinnerDemo, progressBarDemo, imageDemo, levelBarDemo];
