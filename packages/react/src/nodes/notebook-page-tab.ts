import type * as Gtk from "@gtkx/ffi/gtk";
import type { SlotProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { NotebookPageNode } from "./notebook-page.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class NotebookPageTabNode extends VirtualNode<SlotProps, NotebookPageNode, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof VirtualNode && parent.typeName === "NotebookPage";
    }

    private getNotebook(): Gtk.Notebook | null {
        return this.parent?.parent?.container ?? null;
    }

    private getPage(): Gtk.Widget | null {
        return this.parent?.findContentChild()?.container ?? null;
    }

    public override appendChild(child: WidgetNode): void {
        super.appendChild(child);

        if (this.parent) {
            this.onChildChange();
        }
    }

    public override removeChild(child: WidgetNode): void {
        super.removeChild(child);

        if (this.parent) {
            this.onChildChange();
        }
    }

    private onChildChange(): void {
        const notebook = this.getNotebook();
        const page = this.getPage();

        if (!notebook || !page) {
            return;
        }

        if (notebook.pageNum(page) === -1) {
            return;
        }

        notebook.setTabLabel(page, this.children[0]?.container ?? null);
    }
}
