import type * as Gtk from "@gtkx/ffi/gtk";
import type { GridChildProps } from "../jsx.js";
import { PositionalChildNode } from "./abstract/positional-child.js";
import { hasChanged } from "./internal/utils.js";

type Props = Partial<GridChildProps>;

export class GridChildNode extends PositionalChildNode<Props> {
    protected override attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        const grid = parent as Gtk.Grid;
        const column = this.props.column ?? 0;
        const row = this.props.row ?? 0;
        const columnSpan = this.props.columnSpan ?? 1;
        const rowSpan = this.props.rowSpan ?? 1;

        const existingChild = grid.getChildAt(column, row);
        if (existingChild && existingChild !== child) {
            grid.remove(existingChild);
        }

        grid.attach(child, column, row, columnSpan, rowSpan);
    }

    protected override detachFromParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        (parent as Gtk.Grid).remove(child);
    }

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: Props | null, newProps: Props): void {
        const positionChanged =
            hasChanged(oldProps, newProps, "column") ||
            hasChanged(oldProps, newProps, "row") ||
            hasChanged(oldProps, newProps, "columnSpan") ||
            hasChanged(oldProps, newProps, "rowSpan");

        if (positionChanged && this.parentWidget && this.childWidget) {
            this.reattachChild();
        }
    }

    private reattachChild(): void {
        const grid = this.getTypedParentWidget<Gtk.Grid>();
        const child = this.childWidget;

        if (!child) {
            return;
        }

        const column = this.props.column ?? 0;
        const row = this.props.row ?? 0;
        const columnSpan = this.props.columnSpan ?? 1;
        const rowSpan = this.props.rowSpan ?? 1;

        const existingChild = grid.getChildAt(column, row);
        if (existingChild && existingChild !== child) {
            grid.remove(existingChild);
        }

        grid.remove(child);
        grid.attach(child, column, row, columnSpan, rowSpan);
    }
}
