import * as Gtk from "@gtkx/ffi/gtk";
import type { NotebookPageProps } from "../jsx.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import { scheduleAfterCommit } from "../scheduler.js";
import { NotebookPageTabNode } from "./notebook-page-tab.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type Props = Partial<NotebookPageProps>;

export class NotebookPageNode extends SlotNode<Props> {
    public static override priority = 1;

    position?: number | null;
    private tabNode?: NotebookPageTabNode;

    public static override matches(type: string): boolean {
        return type === "Notebook.Page";
    }

    public setNotebook(notebook?: Gtk.Notebook): void {
        this.setParent(notebook);
        this.updateTabNode();
    }

    public setPosition(position?: number | null): void {
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
            this.tabNode.setPage(this.parent as Gtk.Notebook | undefined, this.child);
        }
    }

    public override appendChild(child: Node): void {
        if (child instanceof NotebookPageTabNode) {
            this.tabNode = child;
            scheduleAfterCommit(() => {
                this.updateTabNode();
            });
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(
                `Cannot append '${child.typeName}' to 'Notebook.Page': expected Widget or Notebook.PageTab`,
            );
        }

        const oldChild = this.child;
        this.child = child.container;

        scheduleAfterCommit(() => {
            if (this.parent) {
                this.onChildChange(oldChild ?? null);
            }
            this.updateTabNode();
        });
    }

    public override removeChild(child?: Node): void {
        if (child instanceof NotebookPageTabNode) {
            this.tabNode = undefined;
            return;
        }

        super.removeChild();
    }

    public override unmount(): void {
        this.tabNode = undefined;
        super.unmount();
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        if (!oldProps || oldProps.label !== newProps.label) {
            if (this.child && this.parent && !this.tabNode?.child) {
                const tabLabel = this.getNotebook().getTabLabel(this.child) as Gtk.Label;
                tabLabel.setLabel(newProps.label ?? "");
            }
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

        if (this.position !== undefined) {
            notebook.insertPage(child, tabLabel, this.position);
            return;
        }

        notebook.appendPage(child, tabLabel);
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

registerNodeClass(NotebookPageNode);
