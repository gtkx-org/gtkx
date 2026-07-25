import { elements } from "virtual:gtkx-config";
import "./elements.js";
import { registerElements } from "./reconciler/registry.js";

registerElements(elements, { prepend: true });
