import { init } from "@gtkx/gi/gtk";
import { elements } from "virtual:gtkx-config";
import "./element-behaviors.js";
import { registerElements } from "./reconciler/registry.js";

init();
registerElements(elements, { isPrepended: true });
