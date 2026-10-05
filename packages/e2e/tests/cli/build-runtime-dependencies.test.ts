import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const APP_SOURCE = `import assert from "node:assert/strict";
import { Application, ApplicationFlags, createApplication } from "@gtkx/gi/gio";
import { fromVariant, toVariant } from "@gtkx/gi/glib";
import { ParamFlags, paramSpecInt } from "@gtkx/gi/gobject";
import { Label } from "@gtkx/gi/gtk";
import { quit, registerClass } from "@gtkx/runtime";

try {
    const packed = toVariant("a{sv}", { answer: toVariant("i", 42) });
    assert.deepEqual(fromVariant(packed, { recursive: true }), { answer: 42 });
    assert.deepEqual(fromVariant("ay", toVariant("ay", [1, 2, 3])), new Uint8Array([1, 2, 3]));

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

    const application = createApplication(Application, {
        applicationId: "org.gtkx.runtimedependencies",
        flags: ApplicationFlags.NON_UNIQUE,
    });
    application.on("activate", () => {});
    assert.equal(Application.getDefault(), null);
    const completion = application.runAsync(["gtkx-runtime-dependencies"]);
    assert.equal(application.getIsRegistered(), true);
    assert.equal(application.getIsRemote(), false);
    assert.equal(Application.getDefault(), application);
    setImmediate(() => application.quit());
    assert.equal(await completion, 0);
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

it("loads the runtime package without generated bindings installed", () => {
    using project = createCliProject({ prefix: "gtkx-runtime-independent-", omitPackages: ["runtime"] });
    const source = fileURLToPath(new URL("../../../runtime/", import.meta.url));
    const target = join(project.nodeModules, "@gtkx", "runtime");
    mkdirSync(target);
    cpSync(join(source, "dist"), join(target, "dist"), { recursive: true });
    cpSync(join(source, "package.json"), join(target, "package.json"));

    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
        import assert from "node:assert/strict";
        import { quit, TYPE_BOOLEAN, typeFromName } from "@gtkx/runtime";
        assert.equal(typeFromName("gboolean"), TYPE_BOOLEAN);
        quit();
    `], { cwd: project.root, encoding: "utf8", timeout: 60_000 });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
});

it("runs generated overrides in a production bundle", () => {
    using project = createCliProject({
        prefix: "gtkx-build-runtime-dependencies-",
        config: 'export default { applicationId: "org.gtkx.runtimedependencies", codegen: false };\n',
        files: { "src/index.ts": APP_SOURCE },
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
