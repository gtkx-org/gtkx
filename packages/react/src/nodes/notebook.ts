import * as Gtk from "@gtkx/ffi/gtk";
import type { ChildContainer, PageContainer } from "../containers.js";
import type { Props } from "../factory.js";
import { Node } from "../node.js";
import { isPageContainer } from "../predicates.js";
import { VirtualSlotNode } from "./virtual-slot.js";

export class NotebookNode extends Node<Gtk.Notebook> implements PageContainer, ChildContainer {
    static matches(type: string): boolean {
        return type === "GtkNotebook" || type === "GtkNotebook.Root";
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
        this.widget.appendPage(child);
    }

    insertChildBefore(child: Gtk.Widget, before: Gtk.Widget): void {
        const beforePageNum = this.widget.pageNum(before);

        if (beforePageNum >= 0) {
            this.widget.insertPage(child, beforePageNum);
        } else {
            this.widget.appendPage(child);
        }
    }

    detachChild(child: Gtk.Widget): void {
        this.removePage(child);
    }

    override appendChild(child: Node): void {
        if (child instanceof NotebookPageNode) {
            child.parent = this;
            const childWidget = child.getChildWidget();
            const props = child.getSlotProps();
            if (childWidget) {
                this.addPage(childWidget, props.label);
                child.setParentContainer(this);
            }
            return;
        }
        super.appendChild(child);
    }

    override insertBefore(child: Node, before: Node): void {
        if (child instanceof NotebookPageNode) {
            child.parent = this;
            const childWidget = child.getChildWidget();
            const props = child.getSlotProps();
            if (childWidget) {
                const beforeWidget = child.getBeforeWidget(before);
                if (beforeWidget) {
                    this.insertPageBefore(childWidget, props.label, beforeWidget);
                } else {
                    this.addPage(childWidget, props.label);
                }
                child.setParentContainer(this);
            }
            return;
        }
        super.insertBefore(child, before);
    }

    override removeChild(child: Node): void {
        if (child instanceof NotebookPageNode) {
            const childWidget = child.getChildWidget();
            if (childWidget) {
                this.removePage(childWidget);
            }
            child.unmount();
            child.parent = null;
            return;
        }
        super.removeChild(child);
    }
}

type NotebookPageProps = {
    label: string;
};

export class NotebookPageNode extends VirtualSlotNode<PageContainer, NotebookPageProps> {
    static override consumedPropNames = ["label"];

    static matches(type: string): boolean {
        return type === "GtkNotebook.Page";
    }

    protected isValidContainer(parent: Node): parent is Node & PageContainer {
        return isPageContainer(parent);
    }

    protected extractSlotProps(props: Props): NotebookPageProps {
        return {
            label: (props.label as string | undefined) ?? "",
        };
    }

    protected addToContainer(container: PageContainer, child: Gtk.Widget, props: NotebookPageProps): void {
        container.addPage(child, props.label);
    }

    protected insertBeforeInContainer(
        container: PageContainer,
        child: Gtk.Widget,
        props: NotebookPageProps,
        before: Gtk.Widget,
    ): void {
        container.insertPageBefore(child, props.label, before);
    }

    protected removeFromContainer(container: PageContainer, child: Gtk.Widget): void {
        container.removePage(child);
    }

    protected updateInContainer(container: PageContainer, child: Gtk.Widget, props: NotebookPageProps): void {
        container.updatePageLabel(child, props.label);
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        this.updateSlotPropsIfChanged(oldProps, newProps, ["label"]);
        super.updateProps(oldProps, newProps);
    }
}
