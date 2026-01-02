import { batch } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { GridChildProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { SlotNode } from "./slot.js";

type Props = Partial<GridChildProps>;

class GridChildNode extends SlotNode<Props> {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "GridChild";
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

    private getGrid(): Gtk.Grid {
        if (!this.parent) {
            throw new Error("Expected Grid reference to be set on GridChildNode");
        }

        return this.parent as Gtk.Grid;
    }

    private attachChild(): void {
        const grid = this.getGrid();
        const column = this.props.column ?? 0;
        const row = this.props.row ?? 0;
        const columnSpan = this.props.columnSpan ?? 1;
        const rowSpan = this.props.rowSpan ?? 1;

        batch(() => {
            const existingChild = grid.getChildAt(column, row);

            if (existingChild && !existingChild.equals(this.child)) {
                grid.remove(existingChild);
            }

            if (this.child) {
                const currentParent = this.child.getParent();

                if (currentParent?.equals(grid)) {
                    grid.remove(this.child);
                }

                grid.attach(this.child, column, row, columnSpan, rowSpan);
            }
        });
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        const grid = this.getGrid();

        if (oldChild) {
            const parent = oldChild.getParent();

            if (parent?.equals(grid)) {
                grid.remove(oldChild);
            }
        }

        if (this.child) {
            this.attachChild();
        }
    }
}

registerNodeClass(GridChildNode);
