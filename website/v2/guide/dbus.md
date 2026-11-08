---
title: "D-Bus"
description: "Call D-Bus services, export objects, and pack GVariant values with the generated Gio bindings."
---

# D-Bus

GTKX apps use D-Bus through the generated Gio bindings, as GJS apps do: `Gio.DBusProxy` and `Gio.DBusConnection` for calls, signals and properties, with `Variant` from `@gtkx/gi/glib` for the values. The [GJS D-Bus guide](https://gjs.guide/guides/gio/dbus.html) explains the D-Bus concepts; this page covers what is specific to GTKX.

## Calling D-Bus directly

Construct the variants used by `Gio.DBusProxy` with `new Variant(signature, value)` from `@gtkx/gi/glib`, as in GJS. Literal GVariant type strings determine the TypeScript input and unpacked types. For native replies, supply the expected signature as a type parameter when unpacking:

```ts
import * as Gio from "@gtkx/gi/gio";
import { Variant } from "@gtkx/gi/glib";

const getNameOwner = async (proxy: Gio.DBusProxy, name: string) => {
    const reply = await proxy.call(
        "GetNameOwner",
        new Variant("(s)", [name]),
        Gio.DBusCallFlags.NONE,
        -1,
    );
    const [owner] = reply.deepUnpack<"(s)">();
    return owner;
};
```

## GVariant packing and unpacking

Variants expose the [GJS unpacking methods](https://gjs.guide/guides/glib/gvariant.html#unpacking-variants):

| Method              | Behavior                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `unpack()`          | Opens the outer container, leaving its children as variants. Dictionary keys are unpacked.                 |
| `deepUnpack()`      | Opens arrays, tuples, dictionaries, and maybes recursively, retaining the variants held inside `v` values. |
| `recursiveUnpack()` | Opens every container, including nested `v` values.                                                        |

Basic values unpack directly. Byte arrays (`ay`) return `Uint8Array` in every mode, and dictionaries return objects, including dictionaries with numeric keys. `deep_unpack()` aliases `deepUnpack()`, and `Variant.new(signature, value)` aliases construction for compatibility with older GJS code.

Passing a string to `new Variant("ay", text)` produces UTF-8 bytes with a trailing NUL, as in GJS; passing a byte array preserves its bytes. GTKX keeps signed and unsigned 64-bit values as `bigint` to preserve their full precision. Construction accepts `bigint` or safe integer numbers for those types.

Unpacking always reads the variant's actual runtime type. An explicit type parameter describes the signature your code expects; it does not validate that signature at runtime. Without a known constructor signature or explicit type parameter, the result is `unknown`.

## Consuming a service

`Gio.DBusProxy.newForBus` returns a promise for a proxy to one interface of a remote object. The proxy emits `g-signal` for the service's signals, and `getCachedProperty` reads its properties, which `g-properties-changed` reports when they change. `Gio.DBusObjectManagerClient` lists the objects of a service that exports an object manager, with a proxy for each of their interfaces. `Gio.busWatchName` calls its handlers when a name gains or loses its owner, so a client can create its proxy once the service is running:

```ts
import * as Gio from "@gtkx/gi/gio";
import { Variant } from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";

export const watchCounter = (onValue: (value: number | null) => void) => {
    let proxy: Gio.DBusProxy | null = null;
    let disconnect = () => {};
    let generation = 0;

    const forget = () => {
        generation += 1;
        disconnect();
        disconnect = () => {};
        proxy = null;
    };

    const watcher = Gio.busWatchName(
        Gio.BusType.SESSION,
        "com.example.Counter",
        Gio.BusNameWatcherFlags.NONE,
        async (_connection: Gio.DBusConnection, name: string) => {
            const current = generation;

            try {
                const created = await Gio.DBusProxy.newForBus(
                    Gio.BusType.SESSION,
                    Gio.DBusProxyFlags.NONE,
                    null,
                    name,
                    "/com/example/Counter",
                    "com.example.Counter",
                );
                if (current !== generation) return;
                const handler = created.connect(
                    "g-signal",
                    (_sender, signalName, parameters) => {
                        if (signalName === "Changed")
                            onValue(parameters.deepUnpack<"(u)">()[0]);
                    },
                );
                disconnect = () =>
                    GObject.signalHandlerDisconnect(created, handler);
                proxy = created;
                onValue(
                    created.getCachedProperty("Value")?.unpack<"u">() ?? null,
                );
            } catch (error) {
                if (current === generation) console.error(error);
            }
        },
        (_connection: Gio.DBusConnection | null, _name: string) => {
            forget();
            onValue(null);
        },
    );

    return {
        increment: async (step: number) => {
            if (!proxy) return;
            const reply = await proxy.call(
                "Increment",
                new Variant("(u)", [step]),
                Gio.DBusCallFlags.NONE,
                -1,
            );
            onValue(reply.deepUnpack<"(u)">()[0]);
        },
        stop: () => {
            Gio.busUnwatchName(watcher);
            forget();
        },
    };
};
```

A proxy created after its name vanished, or after `stop`, is discarded, and each proxy's signal handler is disconnected when its name vanishes. GIR types the watcher's handlers only as `GObject.Closure`, so annotate their parameters with the types the C documentation gives them, as the example does.

## Exporting an object

`connection.registerObjectWithClosures2` exports an object at a path, given an interface description and three handlers. The method-call handler answers each call exactly once, through the `Gio.DBusMethodInvocation` it receives, with `returnValue` or `returnDbusError`, and may do so after asynchronous work. The property handlers read and write properties; pass `null` for one the interface does not need:

```ts [src/counter-service.ts]
import * as Gio from "@gtkx/gi/gio";
import { Variant } from "@gtkx/gi/glib";

const COUNTER_XML = `<node>
  <interface name="com.example.Counter">
    <method name="Increment">
      <arg type="u" name="step" direction="in"/>
      <arg type="u" name="value" direction="out"/>
    </method>
    <property name="Value" type="u" access="read"/>
    <signal name="Changed">
      <arg type="u" name="value"/>
    </signal>
  </interface>
</node>`;

export const exportCounter = (
    connection: Gio.DBusConnection,
    objectPath: string,
): (() => void) => {
    const info = Gio.DBusNodeInfo.newForXml(COUNTER_XML).lookupInterface(
        "com.example.Counter",
    );
    if (!info)
        throw new Error("The interface description has no com.example.Counter");
    let value = 0;

    const registration = connection.registerObjectWithClosures2(
        objectPath,
        info,
        (
            _connection: Gio.DBusConnection,
            _sender: string,
            _path: string,
            interfaceName: string,
            method: string,
            parameters: Variant,
            invocation: Gio.DBusMethodInvocation,
        ) => {
            if (!(invocation instanceof Gio.DBusMethodInvocation))
                throw new TypeError("Expected a D-Bus method invocation");
            if (method !== "Increment") {
                invocation.returnDbusError(
                    "org.freedesktop.DBus.Error.UnknownMethod",
                    `Unknown method ${method}`,
                );
                return;
            }
            const [step] = parameters.deepUnpack<"(u)">();
            value += step;
            connection.emitSignal(
                null,
                objectPath,
                interfaceName,
                "Changed",
                new Variant("(u)", [value]),
            );
            invocation.returnValue(new Variant("(u)", [value]));
        },
        (
            _connection: Gio.DBusConnection,
            _sender: string,
            _path: string,
            _interfaceName: string,
            property: string,
        ) => (property === "Value" ? new Variant("u", value) : null),
        null,
    );

    return () => connection.unregisterObject(registration);
};
```

The method-call handler's parameters are annotated for the same reason as the watcher's. The `instanceof` check keeps `Gio.DBusMethodInvocation` in production builds, which would otherwise pass the invocation as a plain `GObject.Object`; see [Production bindings](/v2/guide/configuration-and-codegen#production-bindings).

Export from an effect and return the cleanup. [`useApplication()`](/v2/guide/native-state#the-application) returns the application, so render this component inside the [application element](/v2/guide/application-lifecycle#the-application-element):

```tsx [src/components/counter-service.tsx]
import { useApplication } from "@gtkx/react";
import { useEffect } from "react";
import { exportCounter } from "../counter-service.js";

export const CounterService = () => {
    const application = useApplication();

    useEffect(() => {
        const connection = application.getDbusConnection();
        const objectPath = application.getDbusObjectPath();
        if (!connection || !objectPath) return;
        return exportCounter(connection, objectPath);
    }, [application]);

    return null;
};
```

The application element registers the app on the session bus under its application ID before it renders its children, so the connection is ready when the effect runs; both getters return `null` for an app without an ID. `getDbusObjectPath()` is the application's object path, which can hold the object or a path below it. With the application ID `com.example.Counter`, the object lands at `/com/example/Counter`, where the client above looks for it. To export under another name, own it with `Gio.busOwnName` and export from its bus-acquired handler, which receives the connection.

## GJS D-Bus wrappers

GTKX has no equivalent of the `Gio.DBusProxy.makeProxyWrapper` and `Gio.DBusExportedObject.wrapJSObject` helpers from the [GJS D-Bus guide](https://gjs.guide/guides/gio/dbus.html). When porting, replace a proxy wrapper's methods with `proxy.call`, its signals with `g-signal` and its properties with `getCachedProperty`, and export a wrapped object with `registerObjectWithClosures2`. Exporting objects through `Gio.DBusObjectManagerServer` is not supported: it takes `Gio.DBusInterfaceSkeleton` implementations, and JavaScript cannot supply the method table a skeleton returns, so the bindings omit `vfuncGetVtable`.
