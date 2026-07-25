import { elements } from "virtual:gtkx-config";
import { GTK_ELEMENTS } from "./elements.js";
import { registerElements } from "./reconciler/registry.js";

registerElements(elements, GTK_ELEMENTS);
