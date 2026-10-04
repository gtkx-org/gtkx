import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import {
    isolateTypeConsumer,
    runNativeConsumer,
    typecheckFile,
} from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.typeinstance",' +
    " agents: { reference: false, rules: false } };";
const IMPORTS = `import * as GObject from "@gtkx/gi/gobject";
import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
`;
const ACCEPTED = IMPORTS + `import { registerClass } from "@gtkx/runtime";

const initialize = (instance: GObject.TypeInstance): GObject.Value => {
    const value = new GObject.Value();
    value.initFromInstance(instance);
    return value;
};
export const instances = (
    object: GObject.Object,
    fundamental: GObject.ParamSpec,
    action: Gio.Action,
    proxy: Gio.Proxy,
    native: GObject.TypeInstance,
) => [initialize(object), initialize(fundamental), initialize(action), initialize(proxy), initialize(native)];
class Local extends GObject.Object {}
registerClass(Local, { typeName: "GtkxTypeInstanceConsumer" });
export const registered = initialize(new Local());
`;
const REJECTED: Record<string, string> = {
    boxed: "export const initialize = (value: GObject.Value, bytes: GLib.Bytes) => value.initFromInstance(bytes);",
    variant: "export const initialize = (value: GObject.Value, variant: GLib.Variant) => " +
        "value.initFromInstance(variant);",
    empty: "export const initialize = (value: GObject.Value) => value.initFromInstance({});",
    array: "export const initialize = (value: GObject.Value) => value.initFromInstance([]);",
    number: "export const initialize = (value: GObject.Value) => value.initFromInstance(1);",
    bigint: "export const initialize = (value: GObject.Value) => value.initFromInstance(1n);",
    string: "export const initialize = (value: GObject.Value) => value.initFromInstance(\"instance\");",
    boolean: "export const initialize = (value: GObject.Value) => value.initFromInstance(false);",
    constructor: "export const initialize = (value: GObject.Value) => value.initFromInstance(GObject.Object);",
    symbol: "export const initialize = (value: GObject.Value) => value.initFromInstance(Symbol());",
    construction: "export const instance = new GObject.TypeInstance();",
};
const NATIVE_CONSUMER = `import assert from "node:assert/strict";
import * as GObject from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import { fromValue, getHandle, quit } from "@gtkx/runtime";

try {
    const object = Gio.SimpleAction.new("owned", null);
    const action: Gio.Action = object;
    const objectValue = new GObject.Value();
    try {
        objectValue.initFromInstance(action);
        assert.equal(fromValue(getHandle(objectValue)), object);
        assert.equal(objectValue.getObject(), object);
        assert.equal(GObject.typeCheckInstanceIsA(object, GObject.TYPE_OBJECT), true);
    } finally {
        objectValue.unset();
    }
    assert.equal(object.getName(), "owned");
    const spec = GObject.paramSpecString("mode", null, null, null, GObject.ParamFlags.READWRITE);
    const paramValue = new GObject.Value();
    try {
        paramValue.initFromInstance(spec);
        assert.equal(fromValue(getHandle(paramValue)), spec);
        assert.equal(paramValue.getParam(), spec);
        assert.equal(GObject.typeCheckInstanceIsA(spec, GObject.TYPE_PARAM), true);
    } finally {
        paramValue.unset();
    }
    assert.equal(spec.getName(), "mode");
} finally {
    quit();
}
`;

const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.ts`, IMPORTS + source,
]));

describe("generated TypeInstance contract", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-type-instance-types-",
            config: CONFIG,
            files: {
                "accepted.ts": ACCEPTED,
                "native.ts": NATIVE_CONSUMER,
                ...rejectedFiles,
            },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts objects, fundamentals, interfaces and registered subclasses", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
        expect(typecheckFile(project, "native.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects a non-instance %s", (name) => {
        expect(typecheckFile(project, `${name}.ts`)).not.toBe(0);
    });

    it("preserves real object and fundamental identity through initialized GValues", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-type-instance-values-",
            config: CONFIG,
            files: { "probe.ts": NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});
