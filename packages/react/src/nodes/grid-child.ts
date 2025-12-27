import type * as Gtk from "@gtkx/ffi/gtk";
import type { GridChildProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { SlotNode } from "./slot.js";

type Props = Partial<GridChildProps>;

export class GridChildNode extends SlotNode<Props> {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "GridChild";
    }

    public setGrid(grid?: Gtk.Grid): void {
        this.setParent(grid);
    }

    private getGrid(): Gtk.Grid {
        if (!this.parent) {
            throw new Error("Expected Grid reference to be set on GridChildNode");
        }

        return this.parent as Gtk.Grid;
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        if (
            !oldProps ||
            oldProps.column !== newProps.column ||
            oldProps.row !== newProps.row ||
            oldProps.columnSpan !== newProps.columnSpan ||
            oldProps.rowSpan !== newProps.rowSpan
        ) {
            if (this.parent && this.child) {
                this.attachChild();
            }
        }
    }

    private attachChild(): void {
        const grid = this.getGrid();
        const column = this.props.column ?? 0;
        const row = this.props.row ?? 0;
        const columnSpan = this.props.columnSpan ?? 1;
        const rowSpan = this.props.rowSpan ?? 1;
        const existingChild = grid.getChildAt(column, row);

        if (existingChild && !existingChild.equals(this.child)) {
            grid.remove(existingChild);
        }

        if (this.child) {
            const currentParent = this.child.getParent();
            if (currentParent !== null && currentParent.equals(grid)) {
                grid.remove(this.child);
            }
            grid.attach(this.child, column, row, columnSpan, rowSpan);
        }
    }

    protected override onChildChange(): void {
        this.attachChild();
    }
}

registerNodeClass(GridChildNode);
