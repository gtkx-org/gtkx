import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import {
    appendChild,
    type GridAttachable,
    isGridAttachable,
    isRemovable,
    type Removable,
    removeChild,
} from "../widget-capabilities.js";

interface GridWidget extends Gtk.Widget, GridAttachable, Removable {}

const isGridWidget = (widget: Gtk.Widget): widget is GridWidget => isGridAttachable(widget) && isRemovable(widget);

/**
 * Node implementation for GTK Grid widgets.
 * Manages grid layout with positioned children.
 */
export class GridNode implements Node<GridWidget> {
    static needsWidget = true;

    static matches(type: string, widget: Gtk.Widget | null): widget is GridWidget {
        if (type !== "Grid" && type !== "Grid.Root") return false;
        return widget !== null && isGridWidget(widget);
    }

    private widget: GridWidget;

    constructor(_type: string, widget: Gtk.Widget, _props: Props) {
        if (!isGridWidget(widget)) {
            throw new Error("GridNode requires a Grid widget");
        }
        this.widget = widget;
    }

    getWidget(): GridWidget {
        return this.widget;
    }

    appendChild(child: Node): void {
        child.attachToParent(this);
    }

    removeChild(child: Node): void {
        child.detachFromParent(this);
    }

    insertBefore(child: Node, _before: Node): void {
        this.appendChild(child);
    }

    attachToParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (parentWidget) {
            appendChild(parentWidget, this.widget);
        }
    }

    detachFromParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (parentWidget) {
            removeChild(parentWidget, this.widget);
        }
    }

    updateProps(oldProps: Props, newProps: Props): void {
        const consumedProps = new Set(["children"]);
        const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

        for (const key of allKeys) {
            if (consumedProps.has(key)) continue;

            const oldValue = oldProps[key];
            const newValue = newProps[key];

            if (oldValue === newValue) continue;

            if (key.startsWith("on")) {
                continue;
            }

            const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            const setter = this.widget[setterName as keyof typeof this.widget];
            if (typeof setter === "function") {
                (setter as (value: unknown) => void).call(this.widget, newValue);
            }
        }
    }

    mount(): void {}
}

/**
 * Node implementation for Grid child positioning.
 * Manages column, row, and span properties for grid children.
 */
export class GridChildNode implements Node {
    static needsWidget = false;

    static matches(type: string, _widget: Gtk.Widget | null): _widget is Gtk.Widget {
        return type === "Grid.Child";
    }

    private column: number;
    private row: number;
    private columnSpan: number;
    private rowSpan: number;
    private childWidget: Gtk.Widget | null = null;
    private parentGrid: GridNode | null = null;

    constructor(_type: string, _widget: Gtk.Widget, props: Props) {
        this.column = (props.column as number) ?? 0;
        this.row = (props.row as number) ?? 0;
        this.columnSpan = (props.columnSpan as number) ?? 1;
        this.rowSpan = (props.rowSpan as number) ?? 1;
    }

    appendChild(child: Node): void {
        const widget = child.getWidget?.();
        if (widget) {
            this.childWidget = widget;
            if (this.parentGrid) {
                this.attachChildToGrid();
            }
        }
    }

    removeChild(child: Node): void {
        const widget = child.getWidget?.();
        if (widget && this.childWidget === widget) {
            this.detachChildFromGrid();
            this.childWidget = null;
        }
    }

    insertBefore(child: Node, _before: Node): void {
        this.appendChild(child);
    }

    private attachChildToGrid(): void {
        if (!this.parentGrid || !this.childWidget) return;

        const grid = this.parentGrid.getWidget();
        grid.attach(this.childWidget.ptr, this.column, this.row, this.columnSpan, this.rowSpan);
    }

    private detachChildFromGrid(): void {
        if (!this.parentGrid || !this.childWidget) return;

        const grid = this.parentGrid.getWidget();
        grid.remove(this.childWidget.ptr);
    }

    attachToParent(parent: Node): void {
        if (parent instanceof GridNode) {
            this.parentGrid = parent;
            if (this.childWidget) {
                this.attachChildToGrid();
            }
        }
    }

    detachFromParent(parent: Node): void {
        if (parent instanceof GridNode) {
            this.detachChildFromGrid();
            this.parentGrid = null;
        }
    }

    updateProps(oldProps: Props, newProps: Props): void {
        const positionChanged =
            oldProps.column !== newProps.column ||
            oldProps.row !== newProps.row ||
            oldProps.columnSpan !== newProps.columnSpan ||
            oldProps.rowSpan !== newProps.rowSpan;

        if (positionChanged) {
            this.detachChildFromGrid();
            this.column = (newProps.column as number) ?? 0;
            this.row = (newProps.row as number) ?? 0;
            this.columnSpan = (newProps.columnSpan as number) ?? 1;
            this.rowSpan = (newProps.rowSpan as number) ?? 1;
            this.attachChildToGrid();
        }
    }

    mount(): void {}
}
