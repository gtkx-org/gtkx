import { Fragment, type ReactNode, useSyncExternalStore } from "react";
import { type CellRenderer, ListCell } from "./list-cell.js";
import type { CellContainerStore } from "./utils/cell-container-store.js";
import type { ItemResolver } from "./utils/item-resolver.js";

export interface CellRenderHostProps<T, S> {
    store: CellContainerStore;
    resolver: ItemResolver<T, S>;
    render: CellRenderer<T, S>;
}

export const CellRenderHost = <T, S>({ store, resolver, render }: CellRenderHostProps<T, S>): ReactNode => {
    const containers = useSyncExternalStore(
        store.subscribeSet,
        store.getContainersSnapshot,
        store.getContainersSnapshot,
    );
    return (
        <Fragment>
            {containers.map((container) => (
                <ListCell
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
