import type * as Gtk from "@gtkx/ffi/gtk";
import type { SlotProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { SlotNode } from "./slot.js";

type Props = Partial<SlotProps>;

export class NotebookPageTabNode extends SlotNode<Props> {
    public static override priority = 1;

    private notebook?: Gtk.Notebook;
    private page?: Gtk.Widget;

    public static override matches(type: string): boolean {
        return type === "Notebook.PageTab";
    }

    public setPage(notebook?: Gtk.Notebook, page?: Gtk.Widget): void {
        this.notebook = notebook;
        this.page = page;
        this.setParent(notebook);
    }

    private getNotebook(): Gtk.Notebook {
        if (!this.notebook) {
            throw new Error("Expected Notebook reference to be set on NotebookPageTabNode");
        }
        return this.notebook;
    }

    private getPage(): Gtk.Widget {
        if (!this.page) {
            throw new Error("Expected page reference to be set on NotebookPageTabNode");
        }
        return this.page;
    }

    protected override onChildChange(_oldChild: Gtk.Widget | null): void {
        if (!this.notebook || !this.page) {
            return;
        }

        const notebook = this.getNotebook();
        const page = this.getPage();

        if (notebook.pageNum(page) === -1) {
            return;
        }

        notebook.setTabLabel(page, this.child);
    }
}

registerNodeClass(NotebookPageTabNode);
