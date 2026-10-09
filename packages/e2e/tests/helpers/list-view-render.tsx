import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { useState, useSyncExternalStore } from "react";

type ItemEntry = { host: Gtk.ListItem | Gtk.ListHeader; key: string; item: GObject.Object | null };
type ItemRenderer = (item: GObject.Object) => ReactNode;

type ItemStore = {
    getSnapshot: () => ItemEntry[];
    subscribe: (listener: () => void) => () => void;
    setup: (object: GObject.Object) => void;
    bind: (object: GObject.Object) => void;
    unbind: (object: GObject.Object) => void;
    teardown: (object: GObject.Object) => void;
};

const createItemStore = (): ItemStore => {
    let entries: ItemEntry[] = [];
    let nextKey = 0;
    const listeners: Set<() => void> = new Set();

    const update = (next: ItemEntry[]): void => {
        entries = next;

        for (const listener of listeners) {
            listener();
        }
    };

    const setup = (object: GObject.Object): void => {
        if (object instanceof Gtk.ListItem || object instanceof Gtk.ListHeader) {
            update([...entries, { host: object, key: String(nextKey++), item: null }]);
        }
    };

    const updateItem = (object: GObject.Object, item: GObject.Object | null): void => {
        update(entries.map((entry) => (entry.host === object ? { ...entry, item } : entry)));
    };

    const bind = (object: GObject.Object): void => {
        if (object instanceof Gtk.ListItem || object instanceof Gtk.ListHeader) {
            updateItem(object, object.getItem());
        }
    };

    const unbind = (object: GObject.Object): void => {
        updateItem(object, null);
    };

    const teardown = (object: GObject.Object): void => {
        update(entries.filter((entry) => entry.host !== object));
    };

    return {
        getSnapshot: () => entries,
        subscribe: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        setup,
        bind,
        unbind,
        teardown,
    };
};

function ItemFactory({ renderItem }: { renderItem: ItemRenderer }): ReactNode {
    const [store] = useState(createItemStore);
    const entries = useSyncExternalStore(store.subscribe, store.getSnapshot);

    return (
        <>
            <GtkSignalListItemFactory
                onSetup={store.setup}
                onBind={store.bind}
                onUnbind={store.unbind}
                onTeardown={store.teardown}
            />
            {entries.map((entry) =>
                createPortal(entry.item === null ? null : renderItem(entry.item), entry.host, entry.key),
            )}
        </>
    );
}

export { ItemFactory };
