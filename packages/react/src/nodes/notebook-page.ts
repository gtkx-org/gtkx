import * as Gtk from "@gtkx/ffi/gtk";
import type { NotebookPageProps } from "../jsx.js";
import { Node } from "../node.js";
import { hasChanged } from "./internal/utils.js";
import { NotebookPageTabNode } from "./notebook-page-tab.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type Props = Partial<NotebookPageProps>;

export class NotebookPageNode extends SlotNode<Props> {
    position: number | null = null;
    private tabNode: NotebookPageTabNode | null = null;
    private contentChild: WidgetNode | null = null;

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode || child instanceof NotebookPageTabNode;
    }

    public override setParent(parent: WidgetNode | null): void {
        if (!parent && this.parent) {
            const childWidget = this.contentChild?.container ?? null;
            if (childWidget) {
                this.detachPage(childWidget);
            }
        }

        Node.prototype.setParent.call(this, parent);

        if (parent && this.contentChild) {
            this.onContentChange(null);
        }

        this.updateTabNode();
    }

    public setPosition(position: number | null): void {
        this.position = position;
    }

    private getNotebook(): Gtk.Notebook {
        if (!this.parent) {
            throw new Error("Expected Notebook reference to be set on NotebookPageNode");
        }

        return this.parent.container as Gtk.Notebook;
    }

    private updateTabNode(): void {
        if (this.tabNode) {
            this.tabNode.setPage(
                this.parent ? (this.parent.container as Gtk.Notebook) : null,
                this.contentChild?.container ?? null,
            );
        }
    }

    public override appendChild(child: Node): void {
        if (child instanceof NotebookPageTabNode) {
            this.tabNode = child;
            Node.prototype.appendChild.call(this, child);
            this.updateTabNode();
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'NotebookPage': expected Widget`);
        }

        const oldContent = this.contentChild?.container ?? null;
        this.contentChild = child;
        Node.prototype.appendChild.call(this, child);

        if (this.parent) {
            this.onContentChange(oldContent);
        }
    }

    public override removeChild(child: Node): void {
        if (child instanceof NotebookPageTabNode) {
            this.tabNode = null;
            Node.prototype.removeChild.call(this, child);
            return;
        }

        if (child === this.contentChild) {
            const oldContent = this.contentChild.container;
            this.contentChild = null;
            Node.prototype.removeChild.call(this, child);

            if (this.parent && oldContent) {
                this.onContentChange(oldContent);
            }
            return;
        }

        Node.prototype.removeChild.call(this, child);
    }

    public override detachDeletedInstance(): void {
        const childWidget = this.contentChild?.container ?? null;
        if (childWidget && this.parent) {
            this.detachPage(childWidget);
        }
        this.contentChild = null;
        this.tabNode = null;
    }

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    public override getChildWidget(): Gtk.Widget {
        if (!this.contentChild) {
            throw new Error("Expected content child widget to be set on NotebookPageNode");
        }

        return this.contentChild.container;
    }

    private applyOwnProps(oldProps: Props | null, newProps: Props): void {
        const childWidget = this.contentChild?.container ?? null;

        if (hasChanged(oldProps, newProps, "label") && childWidget && this.parent && !this.tabNode?.children[0]) {
            const tabLabel = this.getNotebook().getTabLabel(childWidget) as Gtk.Label;
            tabLabel.setLabel(newProps.label ?? "");
        }

        const pagePropsChanged =
            hasChanged(oldProps, newProps, "tabExpand") || hasChanged(oldProps, newProps, "tabFill");
        if (childWidget && this.parent && pagePropsChanged) {
            this.applyPageProps();
        }
    }

    private attachPage(): void {
        const child = this.getChildWidget();
        const notebook = this.getNotebook();

        let tabLabel: Gtk.Widget;

        if (this.tabNode?.children[0]) {
            tabLabel = this.tabNode.children[0].container;
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
        const child = this.contentChild?.container ?? null;
        if (!child || !this.parent) return;

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
        if (pageNum !== -1) {
            notebook.removePage(pageNum);
        }
    }

    private onContentChange(oldChild: Gtk.Widget | null): void {
        if (oldChild) {
            this.detachPage(oldChild);
        }

        if (this.contentChild) {
            this.attachPage();
        }
    }
}
