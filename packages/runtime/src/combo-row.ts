import { type ExternalObject, getType, type Handle } from "@gtkx/native";
import { bind } from "./bind.js";
import { biguint64T, booleanT, bufferT, callbackT, objectT, stringT, uint32T, uint64T, voidT } from "./descriptors.js";
import { LIB } from "./library.js";
import { getHandle } from "./registry.js";
import { connectSignalByName } from "./signal.js";
import { TYPE_INVALID, TYPE_OBJECT } from "./type.js";
import { initializeWrapper } from "./wrapper-brand.js";

type NativeHandle = ExternalObject<Handle>;
type Widget = { getFirstChild: () => Widget | null; getNextSibling: () => Widget | null };
type ComboRow = Widget & { getFactory: () => object | null };
type ListItem = { getChild: () => Widget | null };
type State = { factories: Map<NativeHandle, number[]>; boxes: Map<NativeHandle, number> };

const MATCH_DATA = 16;
const MATCH_ROOT = MATCH_DATA | 1 | 2;
const matchArgs = [bufferT, uint32T, uint32T, uint32T, bufferT, bufferT, bufferT];
const findHandler = bind(LIB, "g_signal_handler_find", matchArgs, uint64T);
const disconnectHandler = bind(LIB, "g_signal_handler_disconnect", [bufferT, uint64T], voidT);
const isConnected = bind(LIB, "g_signal_handler_is_connected", [bufferT, uint64T], booleanT);
const lookup = bind(LIB, "g_signal_lookup", [stringT("borrowed"), biguint64T], uint32T);
const quark = bind(LIB, "g_quark_from_string", [stringT("borrowed")], uint32T);
const rootSignal = { id: 0, detail: 0 };
const DESTROY_CALLBACK = callbackT([{ ...objectT(), isCallScoped: true }, bufferT], voidT, {
    hasUserData: true,
    userDataIndex: 1,
    hasDestroy: true,
    destroyKind: "closureNotify",
    scope: "notified",
});
const connectDestroy = bind(
    LIB,
    "g_signal_connect_data",
    [objectT(), stringT("borrowed"), DESTROY_CALLBACK, uint32T],
    uint64T,
);

const retainLiveHandles = <T>(handles: Map<NativeHandle, T>): void => {
    for (const handle of handles.keys()) {
        if (getType(handle) === TYPE_INVALID) {
            handles.delete(handle);
        }
    }
};

const trackRootHandler = (widget: Widget, state: State, owner: NativeHandle): void => {
    const handle = getHandle(widget);
    const id = findHandler(handle, MATCH_ROOT, rootSignal.id, rootSignal.detail, null, null, owner) as number;

    if (id !== 0) {
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
    const pending: Widget[] = [row];

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
    const ids = ["setup", "bind", "unbind"].map((signal) =>
        findHandler(handle, MATCH_DATA | 1, lookup(signal, getType(handle)), 0, null, null, owner) as number,
    );

    if (!state.factories.has(handle) && ids.every((id) => id !== 0)) {
        const id = connectSignalByName(factory, "bind", (item: unknown) => {
            trackBox(item as ListItem, state, owner);
        });
        state.factories.set(handle, [...ids, id]);
    }

    trackCurrentBoxes(row, state);
};

const disconnectTracked = (handle: NativeHandle, ids: number[]): void => {
    if (getType(handle) === TYPE_INVALID) {
        return;
    }

    for (const id of ids) {
        if (isConnected(handle, id)) {
            disconnectHandler(handle, id);
        }
    }
};

const destroyRow = (state: State): void => {
    for (const [factory, ids] of state.factories) {
        disconnectTracked(factory, ids);
    }

    for (const [box, id] of state.boxes) {
        disconnectTracked(box, [id]);
    }

    state.factories.clear();
    state.boxes.clear();
};

function installComboRowFactoryOverride(prototype: ComboRow): void {
    rootSignal.id = lookup("notify", TYPE_OBJECT) as number;
    rootSignal.detail = quark("root") as number;
    Object.defineProperty(prototype, initializeWrapper, {
        value: function (this: ComboRow): void {
            const state: State = { factories: new Map(), boxes: new Map() };
            const receiver = new WeakRef(this);
            trackFactory(this, state);
            connectSignalByName(this, "notify::factory", () => {
                const row = receiver.deref();

                if (row !== undefined) {
                    trackFactory(row, state);
                }
            });
            connectDestroy(getHandle(this), "destroy", () => {
                destroyRow(state);
            }, 0);
        },
    });
}

export { installComboRowFactoryOverride };
