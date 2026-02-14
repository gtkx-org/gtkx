import type * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import { HeaderItemRenderer } from "./header-item-renderer.js";
import type { SignalStore } from "./signal-store.js";

type HeaderRendererConfig = {
    signalStore: SignalStore;
    isEnabled: () => boolean;
    resolveItem: (id: string) => unknown;
    setFactory: (factory: Gtk.SignalListItemFactory | null) => void;
};

export function updateHeaderRenderer(
    current: HeaderItemRenderer | null,
    config: HeaderRendererConfig,
    renderFn: ((item: unknown) => ReactNode) | null | undefined,
): HeaderItemRenderer | null {
    if (renderFn) {
        if (!current && config.isEnabled()) {
            current = new HeaderItemRenderer(config.signalStore);
            current.setResolveItem(config.resolveItem);
            config.setFactory(current.getFactory());
        }
        if (current) {
            current.setRenderFn(renderFn);
        }
    } else if (current) {
        config.setFactory(null);
        current.dispose();
        current = null;
    }
    return current;
}
