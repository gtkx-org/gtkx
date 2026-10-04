import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, runNativeConsumer, typecheckFile, typecheckProject } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.nativeinputs",
    libraries: ["NativeInputs-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as NativeInputs from "@gtkx/gi/nativeinputs";
declare const context: Gdk.AppLaunchContext;
declare const info: Gio.AppInfo;
`;
const ACCEPTED = IMPORTS + `import { createElement } from "react";
import { NativeInputsProbe } from "@gtkx/jsx/nativeinputs";
import { GtkActivateAction } from "@gtkx/jsx/gtk";
import { registerClass } from "@gtkx/runtime";
import * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";

info.launch(null, context);
NativeInputs.useContext(context);
const probe = new NativeInputs.Probe({ context });
probe.context = context;
export const readContext: Gio.AppLaunchContext | null = probe.context;
export const display: Gdk.Display = context.getDisplay();
export const environment: string[] | undefined = readContext?.getEnvironment();
export const returned: Gio.AppLaunchContext = probe.emit("transform", context);
probe.connect("transform", (received) => {
    const value: Gio.AppLaunchContext = received;
    value.getEnvironment();
    return context;
});
NativeInputs.useTransform((received) => {
    const value: Gio.AppLaunchContext = received;
    value.getEnvironment();
    return context;
});
export const element = createElement(NativeInputsProbe, {
    context,
    onTransform: (received) => {
        const value: Gio.AppLaunchContext = received;
        value.getEnvironment();
        return context;
    },
});
class Derived extends NativeInputs.Probe {
    override vfuncTransform(received: Gio.AppLaunchContext): Gdk.AppLaunchContext {
        received.getEnvironment();
        return context;
    }
}
export const Registered = registerClass(Derived);
export const transformed = (fn: NativeInputs.Transform, value: Gio.AppLaunchContext) => fn(value);
export const actionElement = createElement(GtkActivateAction, {
    ref: (instance: Gtk.ShortcutAction | null) => { void instance; },
});
class LocalAction extends GObject.Object implements Gio.ActionImpl {
    vfuncGetName(): string {
        return "local";
    }
}
export const Action = registerClass(LocalAction, { implements: [Gio.Action] });
declare const group: Gio.SimpleActionGroup;
group.addAction(new Action());
`;
const REJECTED = {
    unrelated: "info.launch(null, Gio.SimpleAction.new(\"unrelated\", null));",
    empty: "info.launch(null, {});",
    constructor: "info.launch(null, Gio.AppLaunchContext);",
    method: "context.getDisplay(info, null);",
    callback: "NativeInputs.useTransform((received: Gdk.AppLaunchContext) => received);",
    property: "new NativeInputs.Probe({ context: Gio.SimpleAction.new(\"unrelated\", null) });",
    signal: "new NativeInputs.Probe().emit(\"transform\", Gio.SimpleAction.new(\"unrelated\", null));",
};
const NATIVE = `import assert from "node:assert/strict";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { quit } from "@gtkx/runtime";

try {
    Gtk.init();
    const display = Gdk.Display.getDefault();
    assert.ok(display);
    const context = display.getAppLaunchContext();
    assert.equal(context.getDisplay(), display);
    assert.ok(context instanceof Gio.AppLaunchContext);
    const success = Gio.AppInfo.createFromCommandline("/usr/bin/true", "Native launch", Gio.AppInfoCreateFlags.NONE);
    assert.equal(success.launch(null, context), true);
    const missing = Gio.AppInfo.createFromCommandline(
        "/gtkx-missing-executable", "Missing launch", Gio.AppInfoCreateFlags.NONE,
    );
    assert.throws(() => missing.launch(null, context));
} finally {
    quit();
}
`;

const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.ts`, IMPORTS + source,
]));

describe("generated native object inputs", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/NativeInputs-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-native-inputs-",
            config: CONFIG,
            files: {
                "gir/NativeInputs-1.0.gir": fixture,
                "accepted.ts": ACCEPTED,
                "probe.ts": NATIVE,
                "declarations.json": JSON.stringify({
                    compilerOptions: {
                        strict: true,
                        exactOptionalPropertyTypes: true,
                        target: "ESNext",
                        module: "ESNext",
                        moduleResolution: "Bundler",
                        declaration: true,
                        emitDeclarationOnly: true,
                        outDir: "types",
                        types: ["node"],
                    },
                    files: ["accepted.ts"],
                }),
                ...rejectedFiles,
            },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("passes a native subclass through successful and failed launches", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-native-launch-",
            config: 'export default { applicationId: "org.gtkx.nativelaunch",' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });

    it("accepts native ancestry while preserving returned and received methods", () => {
        expect(typecheckFile(project, "accepted.ts", ["--exactOptionalPropertyTypes"])).toBe(0);
        expect(typecheckFile(project, "probe.ts", ["--exactOptionalPropertyTypes"])).toBe(0);
    });

    it("emits consumer declarations for registered classes and native return values", () => {
        expect(typecheckProject(project, "declarations.json")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects an invalid native input or method in %s", (name) => {
        expect(typecheckFile(project, `${name}.ts`)).not.toBe(0);
    });
});
