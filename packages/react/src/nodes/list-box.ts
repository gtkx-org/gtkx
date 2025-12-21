import { beginBatch, endBatch } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import { isListBoxRow } from "../predicates.js";
import { IndexedChildContainerNode } from "./indexed-child-container.js";

export class ListBoxNode extends IndexedChildContainerNode<Gtk.ListBox> {
    static matches(type: string): boolean {
        return type === "GtkListBox";
    }

    protected getInsertionIndex(before: Gtk.Widget): number {
        const beforeParent = before.getParent();
        if (beforeParent && isListBoxRow(beforeParent)) {
            return beforeParent.getIndex();
        }
        return -1;
    }

    private unparentFromRow(child: Gtk.Widget): void {
        const parent = child.getParent();
        if (parent && isListBoxRow(parent)) {
            beginBatch();
            parent.setChild(undefined);
            this.widget.remove(parent);
            endBatch();
        }
    }

    attachChild(child: Gtk.Widget): void {
        this.unparentFromRow(child);
        this.widget.append(child);
    }

    insertChildBefore(child: Gtk.Widget, before: Gtk.Widget): void {
        this.unparentFromRow(child);

        const index = this.getInsertionIndex(before);
        if (index >= 0) {
            this.widget.insert(child, index);
        } else {
            this.widget.append(child);
        }
    }

    detachChild(child: Gtk.Widget): void {
        if (isListBoxRow(child)) {
            beginBatch();
            child.setChild(undefined);
            this.widget.remove(child);
            endBatch();
            return;
        }
        this.unparentFromRow(child);
    }
}
