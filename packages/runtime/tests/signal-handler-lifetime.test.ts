import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";
import { expect, it } from "vitest";
import { gcUntil } from "./helpers/native-utils.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type Handler = () => void;
type ListenerRegistration = "on" | "once";
type ConnectionLifetime = {
    emitter: WeakRef<Gio.SimpleAction>;
    handler: WeakRef<Handler>;
};

const newAction = (name: string): Gio.SimpleAction => Gio.SimpleAction.new(name, null);
const listenerRegistrations: ListenerRegistration[] = ["on", "once"];
const uniqueName = createTypeNameFactory("_");

const newDeclaredEmitter = () => {
    class DeclaredEmitter extends GObject.Object {}

    const Registered = registerClass(DeclaredEmitter, {
        typeName: uniqueName("GtkxSignalLifetimeEmitter"),
        signals: { ping: {} },
    });

    return new Registered();
};

const collect = async (): Promise<void> => {
    await gcUntil(() => false, 5);
};

const selfCapturedConnection = (): ConnectionLifetime => {
    const emitter = newAction("self-captured");
    const handler = (): void => {
        emitter.getEnabled();
    };
    emitter.connect("activate", handler);

    return { emitter: new WeakRef(emitter), handler: new WeakRef(handler) };
};

const crossCapturedConnections = (): ConnectionLifetime[] => {
    const left = newAction("cross-left");
    const right = newAction("cross-right");
    const leftHandler = (): void => {
        right.getEnabled();
    };
    const rightHandler = (): void => {
        left.getEnabled();
    };
    left.connect("activate", leftHandler);
    right.connect("activate", rightHandler);

    return [
        { emitter: new WeakRef(left), handler: new WeakRef(leftHandler) },
        { emitter: new WeakRef(right), handler: new WeakRef(rightHandler) },
    ];
};

const connectedHandler = (emitter: Gio.SimpleAction, calls: string[]) => {
    const handler = (): void => {
        calls.push(emitter.getName());
    };
    const handlerId = emitter.connect("activate", handler);

    return { handler: new WeakRef(handler), handlerId };
};

const listenerHandler = (emitter: Gio.SimpleAction, registration: ListenerRegistration): WeakRef<Handler> => {
    const handler = (): void => {
        emitter.getEnabled();
    };
    emitter[registration]("activate", handler);

    return new WeakRef(handler);
};

const declaredListenerHandler = (emitter: ReturnType<typeof newDeclaredEmitter>): WeakRef<Handler> => {
    const handler = (): void => {
        emitter.freezeNotify();
    };
    emitter.on("ping", handler);

    return new WeakRef(handler);
};

const externallyOwnedConnection = (calls: string[]) => {
    const group = Gio.SimpleActionGroup.new();
    const emitter = newAction("external");
    const handler = (): void => {
        calls.push("external");
    };
    emitter.connect("activate", handler);
    group.addAction(emitter);

    return {
        group,
        emitter: new WeakRef(emitter),
        handler: new WeakRef(handler),
    };
};

it("collects an emitter whose signal handler captures itself", async () => {
    const connection = selfCapturedConnection();
    await gcUntil(() => connection.emitter.deref() === undefined && connection.handler.deref() === undefined);

    expect(connection.emitter.deref()).toBeUndefined();
    expect(connection.handler.deref()).toBeUndefined();
});

it("collects emitters whose signal handlers capture each other", async () => {
    const connections = crossCapturedConnections();
    await gcUntil(() => connections.every(({ emitter, handler }) => (
        emitter.deref() === undefined && handler.deref() === undefined
    )));

    for (const { emitter, handler } of connections) {
        expect(emitter.deref()).toBeUndefined();
        expect(handler.deref()).toBeUndefined();
    }
});

it("keeps a connected handler alive with its retained emitter and releases it on disconnect", async () => {
    const emitter = newAction("retained");
    const calls: string[] = [];
    const { handler, handlerId } = connectedHandler(emitter, calls);
    await collect();

    expect(handler.deref()).toBeDefined();
    emitter.activate(null);
    expect(calls).toEqual(["retained"]);

    emitter.disconnect(handlerId);
    await gcUntil(() => handler.deref() === undefined);
    expect(handler.deref()).toBeUndefined();
    expect(emitter.getName()).toBe("retained");
});

it("releases a handler disconnected through the generated GObject function", async () => {
    const emitter = newAction("generated-disconnect");
    const calls: string[] = [];
    const { handler, handlerId } = connectedHandler(emitter, calls);

    GObject.signalHandlerDisconnect(emitter, handlerId);
    expect(GObject.signalHandlerIsConnected(emitter, handlerId)).toBe(false);
    await gcUntil(() => handler.deref() === undefined);

    expect(handler.deref()).toBeUndefined();
    expect(emitter.getName()).toBe("generated-disconnect");
    expect(calls).toEqual([]);
});

it.each(listenerRegistrations)(
    "releases a retained %s handler when native disposal destroys its closure",
    async (registration) => {
        const emitter = newAction(`native-disposal-${registration}`);
        const handler = listenerHandler(emitter, registration);

        await collect();
        expect(handler.deref()).toBeDefined();

        emitter.runDispose();
        await gcUntil(() => handler.deref() === undefined);

        expect(handler.deref()).toBeUndefined();
        expect(emitter.getName()).toBe(`native-disposal-${registration}`);
    },
);

it("releases a declared-signal listener when native disposal destroys its closure", async () => {
    const emitter = newDeclaredEmitter();
    const handler = declaredListenerHandler(emitter);

    await collect();
    expect(handler.deref()).toBeDefined();

    emitter.runDispose();
    await gcUntil(() => handler.deref() === undefined);

    expect(handler.deref()).toBeUndefined();
    expect(emitter).toBeInstanceOf(GObject.Object);
});

it("keeps a handler alive while native code owns its emitter", async () => {
    const calls: string[] = [];
    const { group, emitter, handler } = externallyOwnedConnection(calls);
    await collect();

    group.activateAction("external", null);
    expect(calls).toEqual(["external"]);
    expect(emitter.deref()).toBeDefined();
    expect(handler.deref()).toBeDefined();

    group.removeAction("external");
    await gcUntil(() => emitter.deref() === undefined && handler.deref() === undefined);
    expect(emitter.deref()).toBeUndefined();
    expect(handler.deref()).toBeUndefined();
});
