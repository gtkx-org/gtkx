import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { toClosure } from "@gtkx/runtime";
import { afterEach, describe, expect, it } from "vitest";
import { forceGC } from "./helpers/native-utils.js";

type ProbeHandlers = {
    methodCall: (...args: never[]) => unknown;
    getProperty: ((...args: never[]) => unknown) | null;
};

const INTERFACE_XML = `<node>
    <interface name='com.example.Probe'>
        <method name='Ping'>
            <arg type='s' name='message' direction='in'/>
            <arg type='s' name='reply' direction='out'/>
        </method>
        <property name='Answer' type='i' access='read'/>
    </interface>
</node>`;

const OBJECT_PATH = "/com/example/Probe";
const INTERFACE_NAME = "com.example.Probe";
const PROPERTIES_INTERFACE = "org.freedesktop.DBus.Properties";
const CALL_TIMEOUT_MS = 5000;
const CHURN_ROUNDS = 25;
const COLLECTION_ATTEMPTS = 50;
const registrations: { connection: Gio.DBusConnection; id: number }[] = [];

const getInterfaceInfo = (): Gio.DBusInterfaceInfo => {
    const info = Gio.DBusNodeInfo.newForXml(INTERFACE_XML).lookupInterface(INTERFACE_NAME);

    if (info === null) {
        throw new Error(`missing interface info for ${INTERFACE_NAME}`);
    }

    return info;
};

const callProbe = async (
    connection: Gio.DBusConnection,
    options: { interfaceName: string; methodName: string; parameters: GLib.Variant | null },
): Promise<GLib.Variant> =>
    connection.call(
        connection.getUniqueName(),
        OBJECT_PATH,
        options.interfaceName,
        options.methodName,
        options.parameters,
        null,
        Gio.DBusCallFlags.NONE,
        CALL_TIMEOUT_MS,
        null,
    );

const registerProbe = (connection: Gio.DBusConnection, handlers: ProbeHandlers): number => {
    const info = getInterfaceInfo();

    const id = connection.registerObjectWithClosures2(
        OBJECT_PATH,
        info,
        handlers.methodCall,
        handlers.getProperty,
        null,
    );

    registrations.push({ connection, id });

    return id;
};

const registerProbeWith = (methodCall: unknown): (() => number) => {
    const connection = Gio.busGetSync(Gio.BusType.SESSION, null);

    return () =>
        connection.registerObjectWithClosures2(OBJECT_PATH, getInterfaceInfo(), methodCall as never, null, null);
};

const answerPing = (...args: unknown[]): void => {
    (args[6] as Gio.DBusMethodInvocation).returnValue(GLib.Variant.newTuple([GLib.Variant.newString("pong")]));
};

const callPing = async (connection: Gio.DBusConnection): Promise<string> => {
    const reply = await callProbe(connection, {
        interfaceName: INTERFACE_NAME,
        methodName: "Ping",
        parameters: GLib.Variant.newTuple([GLib.Variant.newString("hello")]),
    });

    return reply.getChildValue(0).getString()[0];
};

const buildAndDropClosure = (registry: FinalizationRegistry<string>, label: string): void => {
    const handler = (): string => label;
    registry.register(handler, label);
    toClosure(handler);
};

const waitForCollection = async (collected: string[]): Promise<void> => {
    for (let attempt = 0; attempt < COLLECTION_ATTEMPTS && collected.length === 0; attempt++) {
        forceGC();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
};

afterEach(() => {
    for (const { connection, id } of registrations) {
        connection.unregisterObject(id);
    }

    registrations.length = 0;
});

describe("a JavaScript function passed where a GObject.Closure is expected", () => {
    it("is invoked for a D-Bus method call and answers the caller", async () => {
        const connection = Gio.busGetSync(Gio.BusType.SESSION, null);
        const seen: unknown[] = [];

        const id = registerProbe(connection, {
            methodCall: (...args: unknown[]) => {
                seen.push(args[4], (args[5] as GLib.Variant).getChildValue(0).getString()[0]);
                answerPing(...args);
            },
            getProperty: null,
        });

        expect(id).toBeGreaterThan(0);
        expect(await callPing(connection)).toBe("pong");
        expect(seen).toEqual(["Ping", "hello"]);
    });

    it("has its returned GVariant written into the property getter's reply", async () => {
        const connection = Gio.busGetSync(Gio.BusType.SESSION, null);
        const requested: unknown[] = [];

        registerProbe(connection, {
            methodCall: answerPing,
            getProperty: (...args: unknown[]) => {
                requested.push(args[4]);

                return GLib.Variant.newInt32(42);
            },
        });

        const reply = await callProbe(connection, {
            interfaceName: PROPERTIES_INTERFACE,
            methodName: "Get",
            parameters: GLib.Variant.newTuple([
                GLib.Variant.newString(INTERFACE_NAME),
                GLib.Variant.newString("Answer"),
            ]),
        });

        expect(requested).toEqual(["Answer"]);
        expect(reply.getChildValue(0).getVariant().getInt32()).toBe(42);
    });
});

describe("a GObject.Closure built for every registration", () => {
    it("keeps answering across repeated register and unregister rounds", async () => {
        const connection = Gio.busGetSync(Gio.BusType.SESSION, null);
        const replies: string[] = [];

        for (let round = 0; round < CHURN_ROUNDS; round++) {
            const id = registerProbe(connection, { methodCall: answerPing, getProperty: null });
            replies.push(await callPing(connection));
            connection.unregisterObject(id);
            registrations.length = 0;
        }

        expect(replies).toEqual(Array.from({ length: CHURN_ROUNDS }, () => "pong"));
    });
});

describe("the destroy notify a built GObject.Closure installs", () => {
    it("releases the handler once nothing holds the closure any more", async () => {
        const collected: string[] = [];

        const registry: FinalizationRegistry<string> = new FinalizationRegistry((value) => {
            collected.push(value);
        });

        buildAndDropClosure(registry, "handler");
        await waitForCollection(collected);
        expect(collected).toEqual(["handler"]);
    });
});

describe("a value that cannot become a GObject.Closure", () => {
    it("is refused instead of registering an object that answers nothing", () => {
        expect(registerProbeWith(7)).toThrow();
        expect(registerProbeWith(new Gtk.Label({ label: "" }))).toThrow();
    });

    it("is refused even when it has no prototype", () => {
        expect(registerProbeWith(Object.create(null))).toThrow();
    });
});

describe("a GValue a GObject.Closure is expected to fill in", () => {
    it("carries the handler's write back to the binding target", () => {
        const source = new Gtk.Label({ label: "written" });
        const target = new Gtk.Label({ label: "" });
        const seen: unknown[] = [];

        const binding = source.bindPropertyFull(
            "label",
            target,
            "label",
            GObject.BindingFlags.SYNC_CREATE,
            (...args: unknown[]) => {
                const from = args[1] as GObject.Value;
                seen.push(from.getString());
                (args[2] as GObject.Value).setString(`transformed:${from.getString() ?? ""}`);

                return true;
            },
            () => true,
        );

        expect(seen).toEqual(["written"]);
        expect(target.label).toBe("transformed:written");
        binding.unbind();
    });
});
