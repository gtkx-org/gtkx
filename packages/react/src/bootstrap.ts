import { elements } from "virtual:gtkx-config";
import "./element-behaviors.js";
import { registerElements } from "./reconciler/registry.js";

registerElements(elements, { prepend: true });
