import type * as gtk from "@gtkx/ffi/gtk";
import type { Props } from "./factory.js";

/**
 * Base interface for all node types in the reconciler.
 * Each node manages its own widget lifecycle and parent-child relationships.
 */
export interface Node<W extends gtk.Widget = gtk.Widget> {
    getWidget?(): W;
    appendChild(child: Node): void;
    removeChild(child: Node): void;
    insertBefore(child: Node, before: Node): void;
    updateProps(oldProps: Props, newProps: Props): void;
    mount(): void;
    attachToParent(parent: Node): void;
    detachFromParent(parent: Node): void;
    dispose?(): void;
}
