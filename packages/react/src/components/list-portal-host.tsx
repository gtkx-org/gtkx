import { Fragment, type ReactNode, useSyncExternalStore } from "react";
import type { ItemResolver } from "../utils/item-resolver.js";
import type { RealizedSlotStore } from "../utils/realized-slot-store.js";
import { ListSlot, type SlotRenderer } from "./list-slot.js";

export interface ListPortalHostProps<T, S> {
    store: RealizedSlotStore;
    resolver: ItemResolver<T, S>;
    render: SlotRenderer<T, S>;
}

export const ListPortalHost = <T, S>({ store, resolver, render }: ListPortalHostProps<T, S>): ReactNode => {
    const containers = useSyncExternalStore(store.subscribeSet, store.getSlotsSnapshot, store.getSlotsSnapshot);
    return (
        <Fragment>
            {containers.map((container) => (
                <ListSlot
                    key={store.keyFor(container)}
                    container={container}
                    store={store}
                    resolver={resolver}
                    render={render}
                />
            ))}
        </Fragment>
    );
};
