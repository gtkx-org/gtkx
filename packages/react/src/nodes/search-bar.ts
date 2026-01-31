import type * as GObject from "@gtkx/ffi/gobject";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { filterProps, hasChanged } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type SearchBarProps = Props & {
    onSearchModeChanged?: (searchMode: boolean) => void;
};

const OWN_PROPS = ["onSearchModeChanged"] as const;

export class SearchBarNode extends WidgetNode<Gtk.SearchBar, SearchBarProps> {
    private notifyHandler: SignalHandler | null = null;

    protected override applyUpdate(oldProps: SearchBarProps | null, newProps: SearchBarProps): void {
        super.applyUpdate(
            oldProps ? (filterProps(oldProps, OWN_PROPS) as SearchBarProps) : null,
            filterProps(newProps, OWN_PROPS) as SearchBarProps,
        );

        if (hasChanged(oldProps, newProps, "onSearchModeChanged")) {
            this.setupNotifyHandler(newProps.onSearchModeChanged);
        }
    }

    private setupNotifyHandler(callback?: (searchMode: boolean) => void): void {
        if (this.notifyHandler) {
            this.signalStore.set(this, this.container, "notify", undefined);
            this.notifyHandler = null;
        }

        if (callback) {
            this.notifyHandler = (_searchBar: Gtk.SearchBar, pspec: GObject.ParamSpec) => {
                if (pspec.getName() === "search-mode-enabled") {
                    callback(this.container.getSearchMode());
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
