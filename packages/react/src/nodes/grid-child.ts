import { isObjectEqual } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import type { GridChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { PositionalChildNode } from "./abstract/positional-child.js";
import { hasChanged } from "./internal/utils.js";

type Props = Partial<GridChildProps>;

export class GridChildNode extends PositionalChildNode<Props> {
    public override canBeChildOf(parent: Node): boolean {
        return parent.container instanceof Gtk.Grid;
    }

    protected override attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        const grid = parent as Gtk.Grid;
        const column = this.props.column ?? 0;
        const row = this.props.row ?? 0;
        const columnSpan = this.props.columnSpan ?? 1;
        const rowSpan = this.props.rowSpan ?? 1;

        const existingChild = grid.getChildAt(column, row);
        if (existingChild && !isObjectEqual(existingChild, child)) {
            grid.remove(existingChild);
        }

        grid.attach(child, column, row, columnSpan, rowSpan);
    }

    protected override detachFromParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        (parent as Gtk.Grid).remove(child);
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: Props | null, newProps: Props): void {
        const positionChanged =
            hasChanged(oldProps, newProps, "column") ||
            hasChanged(oldProps, newProps, "row") ||
            hasChanged(oldProps, newProps, "columnSpan") ||
            hasChanged(oldProps, newProps, "rowSpan");

        if (positionChanged && this.parent && this.child) {
            this.reattachChild();
        }
    }

    private reattachChild(): void {
        const grid = this.getTypedParent<Gtk.Grid>();
        const child = this.child;

        if (!child) {
            return;
        }

        const column = this.props.column ?? 0;
        const row = this.props.row ?? 0;
        const columnSpan = this.props.columnSpan ?? 1;
        const rowSpan = this.props.rowSpan ?? 1;

        const existingChild = grid.getChildAt(column, row);
        if (existingChild && !isObjectEqual(existingChild, child)) {
            grid.remove(existingChild);
        }

        grid.remove(child);
        grid.attach(child, column, row, columnSpan, rowSpan);
    }
}
