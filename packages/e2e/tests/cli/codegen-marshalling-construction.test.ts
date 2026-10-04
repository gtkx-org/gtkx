import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import {
    evaluateProject,
    GIO_CONFIG,
    ORIENTABLE_CONFIG,
    typecheckProject,
} from "./codegen-marshalling-project.js";

const NEWV_GUARD_PROBE = `import assert from "node:assert/strict";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";

const launcher = GObject.Object.newv(Gio.SubprocessLauncher, []);
assert.ok(launcher instanceof Gio.SubprocessLauncher);
assert.throws(() => Gio.Subprocess.newv(["/usr/bin/true"], Gio.SubprocessFlags.NONE));
assert.throws(() => GObject.Object.newv(Gio.Subprocess, "x"));
const unbound = Gio.Subprocess.newv;
assert.throws(() => unbound(["/usr/bin/true"]));
`;

describe("gtkx codegen marshalling", () => {
    it("exposes the factory for objects that require initialization", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-initable-factory-",
            config: fixtureConfig("InitableOnly-1.0"),
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        const source = `import { DBusProxy } from "@gtkx/gi/gio";
process.stdout.write(typeof DBusProxy.newForBusSync);`;
        expect(evaluateProject(project, source)).toBe("function");
    });

    it("constructs objects and rejects invalid newv calls", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-newv-guard-",
            config: GIO_CONFIG,
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(() => evaluateProject(project, NEWV_GUARD_PROBE)).not.toThrow();
    });

    it("rejects direct JavaScript construction of callback actions", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-callback-guard-",
            config: ORIENTABLE_CONFIG,
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        const source = `import assert from "node:assert/strict";
import { CallbackAction } from "@gtkx/gi/gtk";

assert.ok(CallbackAction.new(() => true) instanceof CallbackAction);
assert.throws(() => new CallbackAction());`;
        expect(() => evaluateProject(project, source)).not.toThrow();
    });

    it("rejects direct construction for objects that require initialization", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-initable-guard-",
            config: fixtureConfig("InitableOnly-1.0"),
            files: {
                "probe.ts": `import { Client } from "@gtkx/gi/initable-only";
new Client();`,
            },
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(typecheckProject(project)).not.toBe(0);
        const source = `import { DBusProxy } from "@gtkx/gi/gio";
new DBusProxy();`;
        expect(() => evaluateProject(project, source)).toThrow();
    });
});
