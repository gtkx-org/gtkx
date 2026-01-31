import * as Gtk from "@gtkx/ffi/gtk";
import type { NotebookPageProps } from "../jsx.js";
import type { Node } from "../node.js";
import { CommitPriority, scheduleAfterCommit } from "../scheduler.js";
import { hasChanged } from "./internal/utils.js";
import { NotebookPageTabNode } from "./notebook-page-tab.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type Props = Partial<NotebookPageProps>;

export class NotebookPageNode extends SlotNode<Props> {
    position: number | null = null;
    private tabNode: NotebookPageTabNode | null = null;

    public override setParent(parent: Gtk.Widget | null): void {
        super.setParent(parent);
        this.updateTabNode();
    }

    public setPosition(position: number | null): void {
        this.position = position;
    }

    private getNotebook(): Gtk.Notebook {
        if (!this.parent) {
            throw new Error("Expected Notebook reference to be set on NotebookPageNode");
        }

        return this.parent as Gtk.Notebook;
    }

    private updateTabNode(): void {
        if (this.tabNode) {
            this.tabNode.setPage(this.parent as Gtk.Notebook | null, this.child);
        }
    }

    public override appendChild(child: Node): void {
        if (child instanceof NotebookPageTabNode) {
            this.tabNode = child;
            scheduleAfterCommit(() => {
                this.updateTabNode();
            }, CommitPriority.NORMAL);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(
                `Cannot append '${child.typeName}' to 'x.NotebookPage': expected Widget or x.NotebookPageTab`,
            );
        }

        const oldChild = this.child;
        this.child = child.container;

        scheduleAfterCommit(() => {
            if (this.parent) {
                this.onChildChange(oldChild ?? null);
            }
            this.updateTabNode();
        }, CommitPriority.NORMAL);
    }

    public override removeChild(child: Node): void {
        if (child instanceof NotebookPageTabNode) {
            this.tabNode = null;
            return;
        }

        super.removeChild(child);
    }

    public override unmount(): void {
        this.tabNode = null;
        super.unmount();
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: Props | null, newProps: Props): void {
        if (hasChanged(oldProps, newProps, "label") && this.child && this.parent && !this.tabNode?.child) {
            const tabLabel = this.getNotebook().getTabLabel(this.child) as Gtk.Label;
            tabLabel.setLabel(newProps.label ?? "");
        }

        const pagePropsChanged =
            hasChanged(oldProps, newProps, "tabExpand") || hasChanged(oldProps, newProps, "tabFill");
        if (this.child && this.parent && pagePropsChanged) {
            this.applyPageProps();
        }
    }

    private attachPage(): void {
        const child = this.getChild();
        const notebook = this.getNotebook();

        let tabLabel: Gtk.Widget;

        if (this.tabNode?.child) {
            tabLabel = this.tabNode.child;
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
        const child = this.child;
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
        notebook.removePage(pageNum);
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        if (oldChild) {
            this.detachPage(oldChild);
        }

        if (this.child) {
            this.attachPage();
        }
    }
}
