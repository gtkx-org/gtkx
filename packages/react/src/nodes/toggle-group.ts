import type * as Adw from "@gtkx/ffi/adw";
import type * as GObject from "@gtkx/ffi/gobject";
import type { Props } from "../types.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { filterProps, hasChanged } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type ToggleGroupProps = Props & {
    onActiveChanged?: (active: number, activeName: string | null) => void;
};

const OWN_PROPS = ["onActiveChanged"] as const;

export class ToggleGroupNode extends WidgetNode<Adw.ToggleGroup, ToggleGroupProps> {
    private notifyHandler: SignalHandler | null = null;

    protected override applyUpdate(oldProps: ToggleGroupProps | null, newProps: ToggleGroupProps): void {
        super.applyUpdate(
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

    public override detachDeletedInstance(): void {
        if (this.notifyHandler) {
            this.signalStore.set(this, this.container, "notify", undefined);
            this.notifyHandler = null;
        }
        super.detachDeletedInstance();
    }
}
