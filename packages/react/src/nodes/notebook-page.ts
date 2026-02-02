import * as Gtk from "@gtkx/ffi/gtk";
import type { NotebookPageProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/props.js";
import { NotebookPageTabNode } from "./notebook-page-tab.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

type NotebookPageChild = WidgetNode | NotebookPageTabNode;

export class NotebookPageNode extends VirtualNode<NotebookPageProps, WidgetNode<Gtk.Notebook>, NotebookPageChild> {
    private position: number | null = null;

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode || child instanceof NotebookPageTabNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Gtk.Notebook;
    }

    public findTabNode(): NotebookPageTabNode | undefined {
        return this.children.find((c): c is NotebookPageTabNode => c instanceof NotebookPageTabNode);
    }

    public findContentChild(): WidgetNode | undefined {
        return this.children.find(
            (c): c is WidgetNode => c instanceof WidgetNode && !(c instanceof NotebookPageTabNode),
        );
    }

    public override setParent(parent: WidgetNode<Gtk.Notebook> | null): void {
        if (!parent && this.parent) {
            const childWidget = this.findContentChild()?.container ?? null;
            if (childWidget) {
                this.detachPage(childWidget);
            }
        }

        super.setParent(parent);

        if (parent && this.findContentChild()) {
            this.onChildChange(null);
        }
    }

    public override appendChild(child: NotebookPageChild): void {
        if (child instanceof NotebookPageTabNode) {
            super.appendChild(child);
            return;
        }

        const oldContent = this.findContentChild()?.container ?? null;
        super.appendChild(child);

        if (this.parent) {
            this.onChildChange(oldContent);
        }
    }

    public override removeChild(child: NotebookPageChild): void {
        if (child instanceof NotebookPageTabNode) {
            super.removeChild(child);
            return;
        }

        const isContent = child === this.findContentChild();
        const oldContent = isContent ? child.container : null;
        super.removeChild(child);

        if (isContent && this.parent && oldContent) {
            this.onChildChange(oldContent);
        }
    }

    public override commitUpdate(oldProps: NotebookPageProps | null, newProps: NotebookPageProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        const childWidget = this.findContentChild()?.container ?? null;
        if (childWidget && this.parent) {
            this.detachPage(childWidget);
        }
        super.detachDeletedInstance();
    }

    public setPosition(position: number | null): void {
        this.position = position;
    }

    public getChildWidget(): Gtk.Widget {
        const contentChild = this.findContentChild();
        if (!contentChild) {
            throw new Error("Expected content child widget to be set on NotebookPageNode");
        }

        return contentChild.container;
    }

    private getParentWidget(): Gtk.Notebook {
        if (!this.parent) {
            throw new Error("Expected parent widget to be set on NotebookPageNode");
        }

        return this.parent.container;
    }

    private applyOwnProps(oldProps: NotebookPageProps | null, newProps: NotebookPageProps): void {
        const contentChild = this.findContentChild();
        const childWidget = contentChild?.container ?? null;
        const tabNode = this.findTabNode();

        if (hasChanged(oldProps, newProps, "label") && childWidget && this.parent && !tabNode?.children[0]) {
            const tabLabel = this.getParentWidget().getTabLabel(childWidget) as Gtk.Label;
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
        const notebook = this.getParentWidget();
        const tabNode = this.findTabNode();

        let tabLabel: Gtk.Widget;

        if (tabNode?.children[0]) {
            tabLabel = tabNode.children[0].container;
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
        const child = this.findContentChild()?.container ?? null;
        if (!child || !this.parent) return;

        const notebook = this.getParentWidget();
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
        const notebook = this.getParentWidget();
        const pageNum = notebook.pageNum(childToDetach);
        if (pageNum !== -1) {
            notebook.removePage(pageNum);
        }
    }

    private onChildChange(oldChild: Gtk.Widget | null): void {
        if (oldChild) {
            this.detachPage(oldChild);
        }

        if (this.findContentChild()) {
            this.attachPage();
        }
    }
}
