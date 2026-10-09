import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const APP_SOURCE = `import assert from "node:assert/strict";
import { Application, ApplicationFlags } from "@gtkx/gi/gio";
import { Variant } from "@gtkx/gi/glib";
import { ParamFlags, paramSpecInt } from "@gtkx/gi/gobject";
import { Label } from "@gtkx/gi/gtk";
import { quit, registerClass } from "@gtkx/runtime";

try {
    assert.deepEqual(new Variant("ay", [1, 2, 3]).deepUnpack(), new Uint8Array([1, 2, 3]));
    const compatible = new Variant("a{sv}", { answer: new Variant("i", 42) });
    assert.deepEqual(compatible.recursiveUnpack(), { answer: 42 });
    assert.equal(compatible.deepUnpack().answer?.getTypeString(), "i");
    assert.equal(compatible.unpack().answer?.getTypeString(), "v");
    assert.equal(Variant.new("s", "packed").deep_unpack(), "packed");

    const CountedLabel = registerClass(class extends Label {}, {
        typeName: "GtkxBundledDependencyLabel",
        cssName: "dependency-label",
        properties: { count: paramSpecInt("count", null, null, 0, 10, 2, ParamFlags.READWRITE) },
    });
    const label = new CountedLabel();
    assert.equal(label.getCssName(), "dependency-label");
    assert.equal(label.count, 2);
    label.count = 4;
    assert.equal(label.count, 4);
    assert.throws(() => { label.count = 11; }, RangeError);

    const application = new Application({
        applicationId: "org.gtkx.runtimedependencies",
        flags: ApplicationFlags.NON_UNIQUE,
    });
    application.on("activate", () => {});
    application.hold();
    assert.equal(Application.getDefault(), null);
    const completion = application.runAsync(["gtkx-runtime-dependencies"]);
    assert.equal(application.getIsRegistered(), true);
    assert.equal(application.getIsRemote(), false);
    assert.equal(Application.getDefault(), application);
    setImmediate(() => application.quit());
    assert.equal(await completion, 0);
    application.release();
    assert.equal(application.getIsRegistered(), false);
    assert.equal(Application.getDefault(), null);
    process.stdout.write("dependencies-ok");
} catch (error) {
    process.stderr.write(String(error));
    process.exitCode = 1;
} finally {
    quit();
}
`;

const NATIVE_VARIANT_SOURCE = `import assert from "node:assert/strict";
import { MenuItem } from "@gtkx/gi/gio";
import { quit } from "@gtkx/runtime";

try {
    const item = MenuItem.new("Native variant", null);
    const label = item.getAttributeValue("label", null);
    assert.ok(label);
    assert.equal(label.unpack(), "Native variant");
    assert.equal(label.deepUnpack(), "Native variant");
    assert.equal(label.recursiveUnpack(), "Native variant");
    process.stdout.write("dependencies-ok");
} catch (error) {
    process.stderr.write(String(error));
    process.exitCode = 1;
} finally {
    quit();
}
`;

it("loads the runtime package without generated bindings installed", () => {
    using project = createCliProject({ prefix: "gtkx-runtime-independent-", omitPackages: ["runtime"] });
    const source = fileURLToPath(new URL("../../../runtime/", import.meta.url));
    const target = join(project.nodeModules, "@gtkx", "runtime");
    mkdirSync(target);
    cpSync(join(source, "dist"), join(target, "dist"), { recursive: true });
    cpSync(join(source, "package.json"), join(target, "package.json"));

    const result = spawnSync(
        process.execPath,
        [
            "--input-type=module",
            "-e",
            `
        import assert from "node:assert/strict";
        import { quit, TYPE_BOOLEAN, typeFromName } from "@gtkx/runtime";
        assert.equal(typeFromName("gboolean"), TYPE_BOOLEAN);
        quit();
    `,
        ],
        { cwd: project.root, encoding: "utf8", timeout: 60_000 },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
});

it.for([
    { name: "generated overrides", source: APP_SOURCE },
    { name: "Variant methods without importing GLib", source: NATIVE_VARIANT_SOURCE },
])("runs $name in a production bundle", ({ source }) => {
    using project = createCliProject({
        prefix: "gtkx-build-runtime-dependencies-",
        config: 'export default { applicationId: "org.gtkx.runtimedependencies", codegen: false };\n',
        files: { "src/index.ts": source },
        hasStore: true,
        shouldShareStore: true,
    });

    runCliOrThrow(project, ["build"]);
    const output = join(project.root, "dist");
    const result = spawnSync(process.execPath, [join(output, "bundle.mjs")], {
        cwd: output,
        encoding: "utf8",
        timeout: 60_000,
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("dependencies-ok");
});
