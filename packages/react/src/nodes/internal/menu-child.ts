import type { Node } from "../../node.js";
import { MenuNode } from "../menu.js";
import type { MenuModel } from "../models/menu.js";

/**
 * Owns a node's submenu {@link MenuModel} and routes menu children to it.
 *
 * Reconciler nodes that host menu children compose this controller: each child
 * mutation is offered to the controller first, which handles it when the child
 * is a {@link MenuNode} and reports back whether it did, leaving the node to
 * fall through to its own child handling otherwise.
 */
export class MenuChildController {
    constructor(public readonly menu: MenuModel) {}

    /**
     * Appends `child` to the submenu when it is a {@link MenuNode}.
     *
     * @returns whether the child was a menu and was handled
     */
    public appendChild(child: Node): boolean {
        if (!(child instanceof MenuNode)) return false;
        this.menu.appendChild(child);
        return true;
    }

    /**
     * Inserts `child` into the submenu when it is a {@link MenuNode}, before
     * `before` when that is also a menu, appending it otherwise.
     *
     * @returns whether the child was a menu and was handled
     */
    public insertBefore(child: Node, before: Node): boolean {
        if (!(child instanceof MenuNode)) return false;
        if (before instanceof MenuNode) {
            this.menu.insertBefore(child, before);
        } else {
            this.menu.appendChild(child);
        }
        return true;
    }

    /**
     * Removes `child` from the submenu when it is a {@link MenuNode}.
     *
     * @returns whether the child was a menu and was handled
     */
    public removeChild(child: Node): boolean {
        if (!(child instanceof MenuNode)) return false;
        this.menu.removeChild(child);
        return true;
    }
}
