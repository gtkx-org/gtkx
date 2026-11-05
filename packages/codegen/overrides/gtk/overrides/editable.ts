import { registerInterfacePropertyTarget } from "@gtkx/runtime/internal";
import { Editable } from "../gtk.js";

registerInterfacePropertyTarget(Editable, "vfuncGetDelegate", (editable) => editable.getDelegate());
