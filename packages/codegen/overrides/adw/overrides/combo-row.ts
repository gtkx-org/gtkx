import { getHandle, getInstanceType } from "@gtkx/runtime";
import {
    connectNativeSignal,
    disconnectNativeSignalHandlers,
    findNativeSignalHandler,
    initializeWrapper,
    isNativeHandleAlive,
    type NativeHandle,
    type SignalHandlerId,
} from "@gtkx/runtime/internal";
import { quarkFromString } from "@gtkx/gi/glib";
import { ConnectFlags, SignalMatchType, signalLookup, TYPE_OBJECT } from "@gtkx/gi/gobject";
import { ListItem, SignalListItemFactory, type Widget } from "@gtkx/gi/gtk";
import { ComboRow } from "../adw.js";

type State = { factories: Map<NativeHandle, SignalHandlerId[]>; boxes: Map<NativeHandle, SignalHandlerId> };

const rootSignal = { id: signalLookup("notify", TYPE_OBJECT), detail: quarkFromString("root") };

const retainLiveHandles = <T>(handles: Map<NativeHandle, T>): void => {
    for (const handle of handles.keys()) {
        if (!isNativeHandleAlive(handle)) {
            handles.delete(handle);
        }
    }
};

const trackRootHandler = (widget: object, state: State, owner: NativeHandle): void => {
    const handle = getHandle(widget);
    const mask = SignalMatchType.DATA | SignalMatchType.ID | SignalMatchType.DETAIL;
    const id = findNativeSignalHandler(handle, mask, rootSignal.id, rootSignal.detail, owner);

    if (id !== 0n) {
        state.boxes.set(handle, id);
    }
};

const trackBox = (item: ListItem, state: State, owner: NativeHandle): void => {
    const child = item.getChild();

    if (child !== null) {
        retainLiveHandles(state.boxes);
        trackRootHandler(child, state, owner);
    }
};

const trackCurrentBoxes = (row: ComboRow, state: State): void => {
    const owner = getHandle(row);
    const pending: Widget[] = [];
    trackRootHandler(row, state, owner);

    for (let child = row.getFirstChild(); child !== null; child = child.getNextSibling()) {
        pending.push(child);
    }

    for (let widget = pending.pop(); widget !== undefined; widget = pending.pop()) {
        trackRootHandler(widget, state, owner);

        for (let child = widget.getFirstChild(); child !== null; child = child.getNextSibling()) {
            pending.push(child);
        }
    }
};

const trackFactory = (row: ComboRow, state: State): void => {
    retainLiveHandles(state.factories);
    const factory = row.getFactory();

    if (factory === null) {
        return;
    }

    const handle = getHandle(factory);
    const owner = getHandle(row);
    const mask = SignalMatchType.DATA | SignalMatchType.ID;
    const ids = ["setup", "bind", "unbind"].map((signal) =>
        findNativeSignalHandler(handle, mask, signalLookup(signal, getInstanceType(factory)), 0, owner),
    );

    if (!state.factories.has(handle) && factory instanceof SignalListItemFactory && ids.every((id) => id !== 0n)) {
        const id = factory.connect("bind", (item) => {
            if (item instanceof ListItem) {
                trackBox(item, state, owner);
            }
        });
        state.factories.set(handle, [...ids, id]);
    }

    trackCurrentBoxes(row, state);
};

const destroyRow = (state: State): void => {
    for (const [factory, ids] of state.factories) {
        disconnectNativeSignalHandlers(factory, ids);
    }

    for (const [box, id] of state.boxes) {
        disconnectNativeSignalHandlers(box, [id]);
    }

    state.factories.clear();
    state.boxes.clear();
};

/* TODO: Keep handler cleanup until libadwaita ties default-factory callbacks to the ComboRow lifetime.
 * https://github.com/gtkx-org/gtkx/issues/727
 */
Object.defineProperty(ComboRow.prototype, initializeWrapper, {
    value: function (this: ComboRow): void {
        const state: State = { factories: new Map(), boxes: new Map() };
        const receiver = new WeakRef(this);
        trackFactory(this, state);
        this.on("notify::factory", () => {
            const row = receiver.deref();

            if (row !== undefined) {
                trackFactory(row, state);
            }
        });
        connectNativeSignal(
            this,
            "destroy",
            () => {
                destroyRow(state);
            },
            ConnectFlags.DEFAULT,
        );
    },
});
