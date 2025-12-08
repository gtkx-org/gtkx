import * as Gtk from "@gtkx/ffi/gtk";
import { type ChildContainer, isPageContainer, type PageContainer } from "../container-interfaces.js";
import type { Props } from "../factory.js";
import { Node } from "../node.js";
import { getStringProp } from "../prop-utils.js";

export class NotebookNode extends Node<Gtk.Notebook> implements PageContainer, ChildContainer {
    static matches(type: string): boolean {
        return type === "Notebook" || type === "Notebook.Root";
    }

    addPage(child: Gtk.Widget, label: string): void {
        const tabLabel = new Gtk.Label();
        tabLabel.setLabel(label);
        this.widget.appendPage(child, tabLabel);
    }

    insertPageBefore(child: Gtk.Widget, label: string, beforeChild: Gtk.Widget): void {
        const beforePageNum = this.widget.pageNum(beforeChild);
        const tabLabel = new Gtk.Label();
        tabLabel.setLabel(label);

        if (beforePageNum >= 0) {
            this.widget.insertPage(child, beforePageNum, tabLabel);
        } else {
            this.widget.appendPage(child, tabLabel);
        }
    }

    removePage(child: Gtk.Widget): void {
        const pageNum = this.widget.pageNum(child);

        if (pageNum >= 0) {
            this.widget.removePage(pageNum);
        }
    }

    updatePageLabel(child: Gtk.Widget, label: string): void {
        const tabLabel = new Gtk.Label();
        tabLabel.setLabel(label);
        this.widget.setTabLabel(child, tabLabel);
    }

    attachChild(child: Gtk.Widget): void {
        this.widget.appendPage(child, null);
    }

    insertChildBefore(child: Gtk.Widget, before: Gtk.Widget): void {
        const beforePageNum = this.widget.pageNum(before);

        if (beforePageNum >= 0) {
            this.widget.insertPage(child, beforePageNum, null);
        } else {
            this.widget.appendPage(child, null);
        }
    }

    detachChild(child: Gtk.Widget): void {
        this.removePage(child);
    }
}

export class NotebookPageNode extends Node {
    static matches(type: string): boolean {
        return type === "Notebook.Page";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    private label: string;
    private childWidget: Gtk.Widget | null = null;
    private parentContainer: (Node & PageContainer) | null = null;

    constructor(type: string, props: Props) {
        super(type, props);
        this.label = getStringProp(props, "label", "");
    }

    getLabel(): string {
        return this.label;
    }

    setChildWidget(widget: Gtk.Widget): void {
        this.childWidget = widget;
    }

    getChildWidget(): Gtk.Widget | null {
        return this.childWidget;
    }

    override appendChild(child: Node): void {
        const childWidget = child.getWidget();
        if (childWidget) {
            this.childWidget = childWidget;
        }
    }

    override attachToParent(parent: Node): void {
        if (isPageContainer(parent) && this.childWidget) {
            this.parentContainer = parent;
            parent.addPage(this.childWidget, this.label);
        }
    }

    override attachToParentBefore(parent: Node, before: Node): void {
        if (isPageContainer(parent) && this.childWidget) {
            this.parentContainer = parent;
            const beforePage = before instanceof NotebookPageNode ? before.getChildWidget() : before.getWidget();

            if (beforePage) {
                parent.insertPageBefore(this.childWidget, this.label, beforePage);
            } else {
                parent.addPage(this.childWidget, this.label);
            }
        }
    }

    override detachFromParent(parent: Node): void {
        if (isPageContainer(parent) && this.childWidget) {
            parent.removePage(this.childWidget);
            this.parentContainer = null;
        }
    }

    protected override consumedProps(): Set<string> {
        const consumed = super.consumedProps();
        consumed.add("label");
        return consumed;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.label !== newProps.label) {
            this.label = getStringProp(newProps, "label", "");

            if (this.parentContainer && this.childWidget) {
                this.parentContainer.updatePageLabel(this.childWidget, this.label);
            }
        }

        super.updateProps(oldProps, newProps);
    }
}
