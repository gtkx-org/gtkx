import type { Demo } from "../types.js";
import { printOverviewDemo } from "./overview.js";
import { printDialogDemo } from "./print-dialog.js";

export const printDemos: Demo[] = [printOverviewDemo, printDialogDemo];
