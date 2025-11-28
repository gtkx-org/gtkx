import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import {
    appendChild,
    disconnectSignalHandlers,
    isConnectable,
    isNotebookLike,
    type NotebookLike,
    removeChild,
} from "../widget-capabilities.js";

interface NotebookWidget extends Gtk.Widget, NotebookLike {}

const isNotebookWidget = (widget: Gtk.Widget): widget is NotebookWidget => isNotebookLike(widget);

export class NotebookNode implements Node<NotebookWidget> {
    static needsWidget = true;

    static matches(type: string, widget: Gtk.Widget | null): widget is NotebookWidget {
        if (type !== "Notebook" && type !== "Notebook.Root") return false;
        return widget !== null && isNotebookWidget(widget);
    }

    private widget: NotebookWidget;
    private signalHandlers = new Map<string, number>();

    constructor(_type: string, widget: Gtk.Widget, _props: Props) {
        if (!isNotebookWidget(widget)) {
            throw new Error("NotebookNode requires a Notebook widget");
        }
        this.widget = widget;
    }

    getWidget(): NotebookWidget {
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

    attachChild(childWidget: Gtk.Widget): void {
        this.widget.appendPage(childWidget.ptr, undefined);
    }

    detachChild(childWidget: Gtk.Widget): void {
        const pageNum = this.widget.pageNum(childWidget.ptr);
        if (pageNum >= 0) {
            this.widget.removePage(pageNum);
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
                const eventName = key
                    .slice(2)
                    .replace(/([A-Z])/g, "-$1")
                    .toLowerCase()
                    .replace(/^-/, "");

                const oldHandlerId = this.signalHandlers.get(eventName);
                if (oldHandlerId !== undefined && isConnectable(this.widget)) {
                    this.signalHandlers.delete(eventName);
                }

                if (typeof newValue === "function" && isConnectable(this.widget)) {
                    const handlerId = this.widget.connect(eventName, newValue as (...args: unknown[]) => void);
                    this.signalHandlers.set(eventName, handlerId);
                }
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

    dispose(): void {
        disconnectSignalHandlers(this.widget, this.signalHandlers);
    }
}
