import * as Adw from "@gtkx/ffi/adw";
import type * as GObject from "@gtkx/ffi/gobject";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { filterProps, hasChanged, matchesAnyClass } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type ToggleGroupProps = Props & {
    onActiveChanged?: (active: number, activeName: string | null) => void;
};

const OWN_PROPS = ["onActiveChanged"] as const;

class ToggleGroupNode extends WidgetNode<Adw.ToggleGroup, ToggleGroupProps> {
    public static override priority = 1;

    private notifyHandler: SignalHandler | null = null;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesAnyClass([Adw.ToggleGroup], containerOrClass);
    }

    public override updateProps(oldProps: ToggleGroupProps | null, newProps: ToggleGroupProps): void {
        super.updateProps(
            oldProps ? (filterProps(oldProps, OWN_PROPS) as ToggleGroupProps) : null,
            filterProps(newProps, OWN_PROPS) as ToggleGroupProps,
        );

        if (hasChanged(oldProps, newProps, "onActiveChanged")) {
            this.setupNotifyHandler(newProps.onActiveChanged);
        }
    }

    private setupNotifyHandler(callback?: (active: number, activeName: string | null) => void): void {
        if (this.notifyHandler) {
            this.signalStore.set(this, this.container, "notify", undefined);
            this.notifyHandler = null;
        }

        if (callback) {
            this.notifyHandler = (pspec: GObject.ParamSpec) => {
                if (pspec.getName() === "active") {
                    callback(this.container.getActive(), this.container.getActiveName());
                }
            };
            this.signalStore.set(this, this.container, "notify", this.notifyHandler);
        }
    }

    public override unmount(): void {
        if (this.notifyHandler) {
            this.signalStore.set(this, this.container, "notify", undefined);
            this.notifyHandler = null;
        }
        super.unmount();
    }
}

registerNodeClass(ToggleGroupNode);
