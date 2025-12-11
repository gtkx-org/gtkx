import type * as Gtk from "@gtkx/ffi/gtk";
import { isChildContainer } from "../container-interfaces.js";
import type { Props } from "../factory.js";
import { Node } from "../node.js";

type ToggleButtonState = {
    lastPropsActive: boolean | undefined;
};

/**
 * Specialized node for GtkToggleButton that prevents signal feedback loops.
 *
 * When multiple ToggleButtons share the same state (controlled components),
 * React syncing the `active` prop via setActive() triggers the `toggled` signal.
 * This node guards against that by tracking the expected active state and
 * suppressing callbacks when the signal was caused by a programmatic update.
 */
export class ToggleButtonNode extends Node<Gtk.ToggleButton, ToggleButtonState> {
    static matches(type: string): boolean {
        return type === "ToggleButton.Root";
    }

    override initialize(props: Props): void {
        this.state = { lastPropsActive: undefined };
        super.initialize(props);
    }

    override attachToParent(parent: Node): void {
        if (isChildContainer(parent)) {
            parent.attachChild(this.widget);
            return;
        }

        super.attachToParent(parent);
    }

    override attachToParentBefore(parent: Node, before: Node): void {
        if (isChildContainer(parent)) {
            const beforeWidget = before.getWidget();

            if (beforeWidget) {
                parent.insertChildBefore(this.widget, beforeWidget);
            } else {
                parent.attachChild(this.widget);
            }

            return;
        }

        super.attachToParentBefore(parent, before);
    }

    override detachFromParent(parent: Node): void {
        if (isChildContainer(parent)) {
            parent.detachChild(this.widget);
            return;
        }

        super.detachFromParent(parent);
    }

    protected override consumedProps(): Set<string> {
        return new Set(["children", "active"]);
    }

    override updateProps(_oldProps: Props, newProps: Props): void {
        const widget = this.getWidget();

        if (!widget) {
            super.updateProps(_oldProps, newProps);
            return;
        }

        const newActive = newProps.active;

        if (typeof newActive === "boolean") {
            this.state.lastPropsActive = newActive;

            if (widget.getActive() !== newActive) {
                widget.setActive(newActive);
            }
        }

        super.updateProps(_oldProps, newProps);
    }

    protected override connectSignal(
        widget: Gtk.Widget,
        eventName: string,
        handler: (...args: unknown[]) => unknown,
    ): void {
        if (eventName === "toggled") {
            const wrappedHandler = (...args: unknown[]): unknown => {
                if (this.widget?.getActive() === this.state.lastPropsActive) {
                    return;
                }

                return handler(...args);
            };

            super.connectSignal(widget, eventName, wrappedHandler);
            return;
        }

        super.connectSignal(widget, eventName, handler);
    }
}
