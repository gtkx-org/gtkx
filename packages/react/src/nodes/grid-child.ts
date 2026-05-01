import * as Gtk from "@gtkx/ffi/gtk";
import type { GridChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/props.js";
import { removeChildFromParent, unparentWidget } from "./internal/widget.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class GridChildNode extends VirtualNode<GridChildProps, WidgetNode<Gtk.Grid>, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Gtk.Grid;
    }

    public override setParent(parent: WidgetNode<Gtk.Grid> | null): void {
        if (!parent && this.parent && this.children[0]) {
            removeChildFromParent(this.parent.container, this.children[0].container);
        }

        super.setParent(parent);

        if (parent && this.children[0]) {
            this.attachToParent(parent.container, this.children[0].container);
        }
    }

    public override appendChild(child: WidgetNode): void {
        super.appendChild(child);

        if (this.parent) {
            unparentWidget(child.container);
            this.attachToParent(this.parent.container, child.container);
        }
    }

    public override removeChild(child: WidgetNode): void {
        if (this.parent) {
            removeChildFromParent(this.parent.container, child.container);
        }

        super.removeChild(child);
    }

    public override commitUpdate(oldProps: GridChildProps | null, newProps: GridChildProps): void {
        super.commitUpdate(oldProps, newProps);

        const positionChanged =
            hasChanged(oldProps, newProps, "column") ||
            hasChanged(oldProps, newProps, "row") ||
            hasChanged(oldProps, newProps, "columnSpan") ||
            hasChanged(oldProps, newProps, "rowSpan");

        if (positionChanged && this.parent && this.children[0]) {
            this.reattachChild();
        }
    }

    public override detachDeletedInstance(): void {
        if (this.parent && this.children[0]) {
            removeChildFromParent(this.parent.container, this.children[0].container);
        }
        super.detachDeletedInstance();
    }

    private attachToParent(parent: Gtk.Grid, child: Gtk.Widget): void {
        const column = this.props.column ?? 0;
        const row = this.props.row ?? 0;
        const columnSpan = this.props.columnSpan ?? 1;
        const rowSpan = this.props.rowSpan ?? 1;

        const existingChild = parent.getChildAt(column, row);
        if (existingChild && existingChild !== child) {
            parent.remove(existingChild);
        }

        parent.attach(child, column, row, columnSpan, rowSpan);
    }

    private reattachChild(): void {
        if (!this.parent || !this.children[0]) return;

        const column = this.props.column ?? 0;
        const row = this.props.row ?? 0;
        const columnSpan = this.props.columnSpan ?? 1;
        const rowSpan = this.props.rowSpan ?? 1;

        const existingChild = this.parent.container.getChildAt(column, row);
        if (existingChild && existingChild !== this.children[0].container) {
            this.parent.container.remove(existingChild);
        }

        this.parent.container.remove(this.children[0].container);
        this.parent.container.attach(this.children[0].container, column, row, columnSpan, rowSpan);
    }
}
