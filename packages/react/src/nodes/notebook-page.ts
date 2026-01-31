import * as Gtk from "@gtkx/ffi/gtk";
import type { NotebookPageProps } from "../jsx.js";
import { Node } from "../node.js";
import { hasChanged } from "./internal/utils.js";
import { NotebookPageTabNode } from "./notebook-page-tab.js";
import { SlotNode } from "./slot.js";

type Props = Partial<NotebookPageProps>;

export class NotebookPageNode extends SlotNode<Props> {
    position: number | null = null;
    private tabNode: NotebookPageTabNode | null = null;

    public override setParentWidget(parent: Gtk.Widget | null): void {
        super.setParentWidget(parent);
        this.updateTabNode();
    }

    public setPosition(position: number | null): void {
        this.position = position;
    }

    private getNotebook(): Gtk.Notebook {
        if (!this.parentWidget) {
            throw new Error("Expected Notebook reference to be set on NotebookPageNode");
        }

        return this.parentWidget as Gtk.Notebook;
    }

    private updateTabNode(): void {
        if (this.tabNode) {
            this.tabNode.setPage(this.parentWidget as Gtk.Notebook | null, this.childWidget);
        }
    }

    public override appendChild(child: Node): void {
        if (child instanceof NotebookPageTabNode) {
            this.tabNode = child;
            Node.prototype.appendChild.call(this, child);
            this.updateTabNode();
            return;
        }

        super.appendChild(child);
        this.updateTabNode();
    }

    public override removeChild(child: Node): void {
        if (child instanceof NotebookPageTabNode) {
            this.tabNode = null;
            Node.prototype.removeChild.call(this, child);
            return;
        }

        super.removeChild(child);
    }

    public override detachDeletedInstance(): void {
        this.tabNode = null;
        super.detachDeletedInstance();
    }

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: Props | null, newProps: Props): void {
        if (
            hasChanged(oldProps, newProps, "label") &&
            this.childWidget &&
            this.parentWidget &&
            !this.tabNode?.childWidget
        ) {
            const tabLabel = this.getNotebook().getTabLabel(this.childWidget) as Gtk.Label;
            tabLabel.setLabel(newProps.label ?? "");
        }

        const pagePropsChanged =
            hasChanged(oldProps, newProps, "tabExpand") || hasChanged(oldProps, newProps, "tabFill");
        if (this.childWidget && this.parentWidget && pagePropsChanged) {
            this.applyPageProps();
        }
    }

    private attachPage(): void {
        const child = this.getChildWidget();
        const notebook = this.getNotebook();

        let tabLabel: Gtk.Widget;

        if (this.tabNode?.childWidget) {
            tabLabel = this.tabNode.childWidget;
        } else {
            const label = new Gtk.Label();
            label.setLabel(this.props.label ?? "");
            tabLabel = label;
        }

        if (this.position != null) {
            notebook.insertPage(child, this.position, tabLabel);
        } else {
            notebook.appendPage(child, tabLabel);
        }

        this.applyPageProps();
    }

    private applyPageProps(): void {
        const child = this.childWidget;
        if (!child || !this.parentWidget) return;

        const notebook = this.getNotebook();
        const page = notebook.getPage(child);
        if (!page) return;

        if (this.props.tabExpand !== undefined) {
            page.setTabExpand(this.props.tabExpand);
        }

        if (this.props.tabFill !== undefined) {
            page.setTabFill(this.props.tabFill);
        }
    }

    private detachPage(childToDetach: Gtk.Widget): void {
        const notebook = this.getNotebook();
        const pageNum = notebook.pageNum(childToDetach);
        notebook.removePage(pageNum);
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        if (oldChild) {
            this.detachPage(oldChild);
        }

        if (this.childWidget) {
            this.attachPage();
        }
    }
}
