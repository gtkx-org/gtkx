import * as GObject from "@gtkx/ffi/gobject";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import {
    appendChild,
    disconnectSignalHandlers,
    isConnectable,
    isDefaultSizable,
    isPresentable,
    removeChild,
} from "../widget-capabilities.js";
import { ActionBarNode } from "./action-bar.js";
import { NotebookNode } from "./notebook.js";
import { OverlayNode } from "./overlay.js";

type CombinedPropHandler = {
    props: string[];
    apply: (widget: Gtk.Widget) => (values: Record<string, unknown>) => void;
};

const COMBINED_PROPS: CombinedPropHandler[] = [
    {
        props: ["defaultWidth", "defaultHeight"],
        apply: (widget) => (values) => {
            if (isDefaultSizable(widget)) {
                const width = (values.defaultWidth as number) ?? -1;
                const height = (values.defaultHeight as number) ?? -1;
                widget.setDefaultSize(width, height);
            }
        },
    },
];

/**
 * Node implementation for standard GTK widgets.
 * Acts as the fallback handler that matches all widget types.
 */
export class WidgetNode implements Node {
    static needsWidget = true;

    static matches(_type: string, widget: Gtk.Widget | null): widget is Gtk.Widget {
        return widget !== null;
    }

    private widget: Gtk.Widget;
    private signalHandlers = new Map<string, number>();

    constructor(_type: string, widget: Gtk.Widget, _props: Props) {
        this.widget = widget;
    }

    getWidget(): Gtk.Widget {
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
        if (parent instanceof NotebookNode) {
            parent.attachChild(this.widget);
            return;
        }
        if (parent instanceof OverlayNode) {
            parent.attachChild(this.widget);
            return;
        }
        if (parent instanceof ActionBarNode) {
            parent.attachChild(this.widget);
            return;
        }

        const parentWidget = parent.getWidget?.();
        if (parentWidget) {
            appendChild(parentWidget, this.widget);
        }
    }

    detachFromParent(parent: Node): void {
        if (parent instanceof NotebookNode) {
            parent.detachChild(this.widget);
            return;
        }
        if (parent instanceof OverlayNode) {
            parent.detachChild(this.widget);
            return;
        }
        if (parent instanceof ActionBarNode) {
            parent.detachChild(this.widget);
            return;
        }

        const parentWidget = parent.getWidget?.();
        if (parentWidget) {
            removeChild(parentWidget, this.widget);
        }
    }

    updateProps(oldProps: Props, newProps: Props): void {
        const consumedProps = new Set(["children", "application"]);

        for (const handler of COMBINED_PROPS) {
            const hasAnyChanged = handler.props.some((prop) => oldProps[prop] !== newProps[prop]);
            if (hasAnyChanged) {
                const values: Record<string, unknown> = {};
                for (const prop of handler.props) {
                    values[prop] = newProps[prop];
                    consumedProps.add(prop);
                }
                handler.apply(this.widget)(values);
            } else {
                for (const prop of handler.props) {
                    consumedProps.add(prop);
                }
            }
        }

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
                if (oldHandlerId !== undefined) {
                    GObject.signalHandlerDisconnect(this.widget, oldHandlerId);
                    this.signalHandlers.delete(eventName);
                }

                if (typeof newValue === "function" && isConnectable(this.widget)) {
                    const handlerId = this.widget.connect(eventName, newValue as (...args: unknown[]) => void);
                    this.signalHandlers.set(eventName, handlerId);
                }
                continue;
            }

            if (newValue === undefined) continue;

            const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            const setter = this.widget[setterName as keyof typeof this.widget];
            if (typeof setter === "function") {
                (setter as (value: unknown) => void).call(this.widget, newValue);
            }
        }
    }

    mount(): void {
        if (isPresentable(this.widget)) {
            this.widget.present();
        }
    }

    dispose(): void {
        disconnectSignalHandlers(this.widget, this.signalHandlers);
    }
}
