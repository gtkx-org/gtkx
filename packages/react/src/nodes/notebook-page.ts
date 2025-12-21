import * as Gtk from "@gtkx/ffi/gtk";
import type { NotebookPageProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { SlotNode } from "./slot.js";

type Props = Partial<NotebookPageProps>;

export class NotebookPageNode extends SlotNode<Props> {
    public static override priority = 1;

    notebook?: Gtk.Notebook;
    position?: number;

    public static override matches(type: string): boolean {
        return type === "NotebookPage";
    }

    public setNotebook(notebook?: Gtk.Notebook): void {
        this.notebook = notebook;
    }

    public setPosition(position?: number): void {
        this.position = position;
    }

    private getNotebook(): Gtk.Notebook {
        if (!this.notebook) {
            throw new Error("Notebook is not set on NotebookPageNode");
        }

        return this.notebook;
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        if (!oldProps || oldProps.label !== newProps.label) {
            if (this.child && this.notebook) {
                const tabLabel = this.notebook.getTabLabel(this.child) as Gtk.Label;
                tabLabel.setLabel(newProps.label ?? "");
            }
        }
    }

    private attachPage(): void {
        const child = this.getChild();
        const notebook = this.getNotebook();
        const tabLabel = new Gtk.Label();
        tabLabel.setLabel(this.props.label ?? "");

        if (this.position !== undefined) {
            notebook.insertPage(child, this.position, tabLabel);
            return;
        }

        notebook.appendPage(child, tabLabel);
    }

    private detachPage(): void {
        if (!this.child) {
            return;
        }

        const notebook = this.getNotebook();
        const pageNum = notebook.pageNum(this.child);
        notebook.removePage(pageNum);
    }

    protected override onChildChange(): void {
        this.detachPage();

        if (this.child) {
            this.attachPage();
        }
    }
}

registerNodeClass(NotebookPageNode);
