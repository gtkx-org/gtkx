import { Node } from "../node.js";
import type { ContainerInfo } from "../types.js";

/**
 * The inert node backing a top-level render root.
 *
 * `react-reconciler` hands {@link render} an opaque per-root sentinel as the
 * container; this node wraps it so the host config has a {@link Node} to drive.
 * Its single child is the application element (or a portal child), which attaches
 * to nothing, so all child mutations are no-ops. It owns the root signal store
 * keyed on the sentinel.
 */
export class RootNode extends Node<undefined, Record<string, never>, Node, Node> {
    constructor(sentinel: ContainerInfo) {
        super("__GTKX_ROOT__", {}, undefined, sentinel);
    }

    public override isValidChild(): boolean {
        return true;
    }

    public override appendChild(child: Node): void {
        child.setParent(this);
    }

    public override removeChild(child: Node): void {
        child.setParent(null);
    }

    public override insertBefore(child: Node): void {
        child.setParent(this);
    }
}
