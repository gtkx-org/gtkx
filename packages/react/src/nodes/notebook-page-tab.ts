import type * as Gtk from "@gtkx/ffi/gtk";
import type { SlotProps } from "../jsx.js";
import { SlotNode } from "./slot.js";

type Props = Partial<SlotProps>;

export class NotebookPageTabNode extends SlotNode<Props> {
    private notebook: Gtk.Notebook | null = null;
    private page: Gtk.Widget | null = null;

    public setPage(notebook: Gtk.Notebook | null, page: Gtk.Widget | null): void {
        this.notebook = notebook;
        this.page = page;
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

    public override onChildChange(_oldChild: Gtk.Widget | null): void {
        if (!this.notebook || !this.page) {
            return;
        }

        const notebook = this.getNotebook();
        const page = this.getPage();

        if (notebook.pageNum(page) === -1) {
            return;
        }

        notebook.setTabLabel(page, this.children[0]?.container ?? null);
    }
}
