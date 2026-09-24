import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import {
    connectSignal,
    disconnectSignal,
    emitSignal,
    getProperty,
    registerClass,
    setProperty,
    type SignalHandlerId,
    t,
} from "@gtkx/runtime";
import { expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

class Emitter extends GObject.Object {}

const Registered = registerClass(Emitter, {
    typeName: createTypeNameFactory("_")("GtkxObjectPtrArrayEmitter"),
    signals: { "items-changed": { paramTypes: [GLib.PtrArray] } },
});

const actionsType = t.ptrArray(t.object("borrowed", () => Gio.SimpleAction, "GSimpleAction"));
const connectActions = (emitter: object, received: Gio.SimpleAction[][]): SignalHandlerId => connectSignal(
    emitter,
    "items-changed",
    {
        callback: t.callback([t.object("borrowed"), actionsType, t.void], t.void, {
            hasDestroy: true,
            destroyKind: "closureNotify",
            hasUserData: true,
            userDataIndex: 2,
        }),
        handler: (actions) => {
            received.push(actions as Gio.SimpleAction[]);
        },
        isAfter: false,
    },
);

it("emits object arrays and preserves received object identity", () => {
    const emitter = new Registered();
    const received: Gio.SimpleAction[][] = [];
    const handler = connectActions(emitter, received);
    const first = Gio.SimpleAction.new("first", null);
    const second = Gio.SimpleAction.new("second", null);
    const actions = [first, second];

    try {
        emitSignal(emitter, "items-changed", [{ type: actionsType, value: actions }]);
        expect(received).toEqual([[first, second]]);
        actions.length = 0;
        expect(received[0]?.map((action) => action.getName())).toEqual(["first", "second"]);
        received[0]?.[0]?.setEnabled(false);
        expect(first.getEnabled()).toBe(false);
    } finally {
        disconnectSignal(emitter, handler);
    }
});

it("retains emitted objects through a copied boxed value and later emission", () => {
    const emitter = new Registered();
    const source = new GObject.Value();
    const retained = new GObject.Value();
    source.init(GLib.PtrArray);
    retained.init(GLib.PtrArray);
    try {
        const capture = emitter.connect("items-changed", (array: GLib.PtrArray) => {
            source.setBoxed(array);
        });
        const actions = [Gio.SimpleAction.new("retained", null)];

        try {
            emitSignal(emitter, "items-changed", [{ type: actionsType, value: actions }]);
            source.copy(retained);
            source.reset();
        } finally {
            emitter.disconnect(capture);
        }
        actions.length = 0;
        const received: Gio.SimpleAction[][] = [];
        const handler = connectActions(emitter, received);

        try {
            emitter.emit("items-changed", retained.getBoxed());
            retained.reset();
            expect(received[0]?.map((action) => action.getName())).toEqual(["retained"]);
            received[0]?.[0]?.setEnabled(false);
            expect(received[0]?.[0]?.getEnabled()).toBe(false);
        } finally {
            disconnectSignal(emitter, handler);
        }
    } finally {
        source.unset();
        retained.unset();
    }
});

it.each([
    { name: "empty", actions: [] },
    { name: "null", actions: null },
])("emits an $name object collection", ({ actions }) => {
    const emitter = new Registered();
    const received: Gio.SimpleAction[][] = [];
    const handler = connectActions(emitter, received);

    try {
        emitSignal(emitter, "items-changed", [{ type: actionsType, value: actions }]);
        expect(received).toEqual([[]]);
    } finally {
        disconnectSignal(emitter, handler);
    }
});

it("propagates a handler error and recovers on the next emission", () => {
    const emitter = new Registered();
    const received: Gio.SimpleAction[][] = [];
    const handler = connectActions(emitter, received);

    try {
        const failing = emitter.connect("items-changed", () => {
            throw new Error("Authored handler failure");
        });

        try {
            expect(() => emitSignal(emitter, "items-changed", [{
                type: actionsType,
                value: [Gio.SimpleAction.new("before-error", null)],
            }])).toThrow();
            expect(received.map((actions) => actions.map((action) => action.getName()))).toEqual([["before-error"]]);
        } finally {
            emitter.disconnect(failing);
        }

        emitSignal(emitter, "items-changed", [{
            type: actionsType,
            value: [Gio.SimpleAction.new("recovered", null)],
        }]);
        expect(received.map((actions) => actions.map((action) => action.getName()))).toEqual([
            ["before-error"], ["recovered"],
        ]);
    } finally {
        disconnectSignal(emitter, handler);
    }
});

class Holder extends GObject.Object {
    declare items: GLib.PtrArray | null;
}

const RegisteredHolder = registerClass(Holder, {
    typeName: createTypeNameFactory("_")("GtkxObjectPtrArrayHolder"),
    properties: {
        items: GObject.paramSpecBoxed("items", null, null, GLib.PtrArray, GObject.ParamFlags.READWRITE),
    },
});

it("reads wrapped objects from a boxed property after replacing its collection", () => {
    const holder = new RegisteredHolder();
    const action = Gio.SimpleAction.new("property", null);
    const input = [action];
    setProperty(holder, "items", actionsType, input);
    input.length = 0;
    const received = getProperty(holder, "items", actionsType) as Gio.SimpleAction[];
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(action);
    setProperty(holder, "items", actionsType, []);
    expect(getProperty(holder, "items", actionsType)).toEqual([]);
    expect(received[0]?.getName()).toBe("property");
    received[0]?.setEnabled(false);
    expect(action.getEnabled()).toBe(false);
});

it("reads default, empty and null object-array property values", () => {
    const holder = new RegisteredHolder();
    expect(getProperty(holder, "items", actionsType)).toEqual([]);
    setProperty(holder, "items", actionsType, []);
    expect(getProperty(holder, "items", actionsType)).toEqual([]);
    setProperty(holder, "items", actionsType, null);
    expect(getProperty(holder, "items", actionsType)).toEqual([]);
});

it("preserves the property write across a notify-handler error and recovers", () => {
    const holder = new RegisteredHolder();
    const failing = holder.connect("notify::items", () => {
        throw new Error("Authored notification failure");
    });
    try {
        expect(() => {
            setProperty(holder, "items", actionsType, [Gio.SimpleAction.new("before-error", null)]);
        }).toThrow();
    } finally {
        holder.disconnect(failing);
    }
    const before = getProperty(holder, "items", actionsType) as Gio.SimpleAction[];
    expect(before.map((action) => action.getName())).toEqual(["before-error"]);
    setProperty(holder, "items", actionsType, [Gio.SimpleAction.new("recovered", null)]);
    const recovered = getProperty(holder, "items", actionsType) as Gio.SimpleAction[];
    expect(recovered.map((action) => action.getName())).toEqual(["recovered"]);
    setProperty(holder, "items", actionsType, null);
});
