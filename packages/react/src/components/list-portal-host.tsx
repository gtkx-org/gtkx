import { Fragment, type ReactNode, useSyncExternalStore } from "react";
import type { ItemResolver } from "../utils/item-resolver.js";
import type { RealizedSlotStore } from "../utils/realized-slot-store.js";
import { ListSlot, type SlotRenderer } from "./list-slot.js";

/**
 * Props for {@link ListPortalHost}.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export interface ListPortalHostProps<T, S> {
    store: RealizedSlotStore;
    resolver: ItemResolver<T, S>;
    render: SlotRenderer<T, S>;
}

/**
 * Renders one memoized {@link ListSlot} per realized container of a factory's store.
 *
 * It subscribes once to the structural set of realized containers via `useSyncExternalStore`, so
 * it re-maps only when a container is added (`setup`) or removed (`teardown`); a pure rebind does
 * not re-render the host. Each container is keyed by its stable WeakMap key so slot identity
 * survives bind/unbind cycles. The `resolver`/`render` props flow into every slot unchanged,
 * letting React reconciliation re-render only the slots whose resolved value or renderer differs.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param props - The slot store, the value resolver, and the per-position renderer.
 * @returns The set of portal slots for the currently realized containers.
 */
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
