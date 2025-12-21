import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import { Node } from "../node.js";

type ToggleButtonState = {
    lastPropsActive: boolean | undefined;
};

export class ToggleButtonNode extends Node<Gtk.ToggleButton, ToggleButtonState> {
    static override consumedPropNames = ["active"];

    static matches(type: string): boolean {
        return type === "GtkToggleButton.Root";
    }

    override initialize(props: Props): void {
        this.state = { lastPropsActive: undefined };
        super.initialize(props);
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
