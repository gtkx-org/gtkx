import type * as GObject from "@gtkx/gi/gobject";
import type { Node } from "./state.js";

export interface ElementMapping {
    matches(child: Node, parent: Node): boolean;
    attach(child: Node, parent: Node, anchor?: GObject.Object | null, fresh?: boolean): void;
    detach(child: Node, parent: Node): void;
}
