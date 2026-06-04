import * as Gtk from "@gtkx/gi/gtk";
import type { NotebookPageProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/props.js";
import { SingleChildVirtualNode } from "./internal/single-child-virtual.js";
import { NotebookPageTabNode } from "./notebook-page-tab.js";
import { WidgetNode } from "./widget.js";

type NotebookPageChild = WidgetNode | NotebookPageTabNode;

export class NotebookPageNode extends SingleChildVirtualNode<
    NotebookPageProps,
    WidgetNode<Gtk.Notebook>,
    NotebookPageChild
> {
    private position: number | null = null;

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode || child instanceof NotebookPageTabNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.backingInstance instanceof Gtk.Notebook;
    }

    public findTabNode(): NotebookPageTabNode | undefined {
        return this.children.find((c): c is NotebookPageTabNode => c instanceof NotebookPageTabNode);
    }

    public findContentChild(): WidgetNode | undefined {
        return this.children.find(
            (c): c is WidgetNode => c instanceof WidgetNode && !(c instanceof NotebookPageTabNode),
        );
    }

    protected override trackedChild(): WidgetNode | null {
        return this.findContentChild() ?? null;
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        if (oldChild) {
            this.detachPage(oldChild);
        }

        if (this.findContentChild()) {
            this.attachPage();
        }
    }

    protected override onDetach(oldChild: Gtk.Widget | null): void {
        if (oldChild) {
            this.detachPage(oldChild);
        }
    }

    public override commitUpdate(oldProps: NotebookPageProps | null, newProps: NotebookPageProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        if (this.findContentChild() && this.parent) {
            const notebook = this.getParentWidget();
            if (notebook.getNPages() <= 1) {
                notebook.setShowTabs(false);
            }
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

        return contentChild.backingInstance;
    }

    private getParentWidget(): Gtk.Notebook {
        if (!this.parent) {
            throw new Error("Expected parent widget to be set on NotebookPageNode");
        }

        return this.parent.backingInstance;
    }

    private applyOwnProps(oldProps: NotebookPageProps | null, newProps: NotebookPageProps): void {
        const contentChild = this.findContentChild();
        const childWidget = contentChild?.backingInstance ?? null;
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
            tabLabel = tabNode.children[0].backingInstance;
        } else {
            const label = new Gtk.Label();
            label.setLabel(this.props.label ?? "");
            tabLabel = label;
        }

        if (this.position == null) {
            notebook.appendPage(child, tabLabel);
        } else {
            notebook.insertPage(child, tabLabel, this.position);
        }

        this.applyPageProps();
    }

    private applyPageProps(): void {
        const child = this.findContentChild()?.backingInstance ?? null;
        if (!child || !this.parent) return;

        const notebook = this.getParentWidget();
        const page = notebook.getPage(child);
        if (!page) return;

        if (this.props.tabExpand !== undefined) {
            page.tabExpand = this.props.tabExpand;
        }

        if (this.props.tabFill !== undefined) {
            page.tabFill = this.props.tabFill;
        }
    }

    private detachPage(childToDetach: Gtk.Widget): void {
        const notebook = this.getParentWidget();
        const pageNum = notebook.pageNum(childToDetach);
        if (pageNum !== -1) {
            notebook.removePage(pageNum);
        }
    }
}
