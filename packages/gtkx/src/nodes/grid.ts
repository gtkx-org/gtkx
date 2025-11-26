import type * as gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";

export class GridNode implements Node {
    static needsWidget = true;

    static matches(type: string): boolean {
        return type === "Grid" || type === "Grid.Root";
    }

    private widget: gtk.Grid;

    constructor(_type: string, widget: gtk.Widget, _props: Props) {
        this.widget = widget as gtk.Grid;
    }

    getWidget(): gtk.Widget {
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
        if (!parentWidget) return;

        if ("setChild" in parentWidget && typeof parentWidget.setChild === "function") {
            (parentWidget.setChild as (ptr: unknown) => void)(this.widget.ptr);
        } else if ("append" in parentWidget && typeof parentWidget.append === "function") {
            (parentWidget.append as (ptr: unknown) => void)(this.widget.ptr);
        }
    }

    detachFromParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (!parentWidget) return;

        if ("remove" in parentWidget && typeof parentWidget.remove === "function") {
            (parentWidget.remove as (ptr: unknown) => void)(this.widget.ptr);
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

export class GridChildNode implements Node {
    static needsWidget = false;

    static matches(type: string): boolean {
        return type === "Grid.Child";
    }

    private column: number;
    private row: number;
    private columnSpan: number;
    private rowSpan: number;
    private childWidget: gtk.Widget | null = null;
    private parentGrid: GridNode | null = null;

    constructor(_type: string, _widget: gtk.Widget, props: Props) {
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
        if (this.parentGrid && this.childWidget) {
            const grid = this.parentGrid.getWidget() as gtk.Grid;
            if ("attach" in grid && typeof grid.attach === "function") {
                grid.attach(this.childWidget.ptr, this.column, this.row, this.columnSpan, this.rowSpan);
            }
        }
    }

    private detachChildFromGrid(): void {
        if (this.parentGrid && this.childWidget) {
            const grid = this.parentGrid.getWidget() as gtk.Grid;
            if ("remove" in grid && typeof grid.remove === "function") {
                (grid.remove as (ptr: unknown) => void)(this.childWidget.ptr);
            }
        }
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
