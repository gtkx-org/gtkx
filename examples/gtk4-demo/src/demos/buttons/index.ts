import type { Demo } from "../types.js";
import { buttonsDemo } from "./buttons.js";
import { checkButtonDemo } from "./check-button.js";
import { linkButtonDemo } from "./link-button.js";
import { switchDemo } from "./switch.js";
import { toggleButtonDemo } from "./toggle-button.js";

export const buttonsDemos: Demo[] = [buttonsDemo, checkButtonDemo, toggleButtonDemo, linkButtonDemo, switchDemo];
