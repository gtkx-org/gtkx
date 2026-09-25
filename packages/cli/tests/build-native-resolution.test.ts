import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createCliProject, runCli, runCliOrThrow } from "./cli-project.js";
import { installNativePackage, NATIVE_ENTRY, type NativeLayout } from "./native-package-fixture.js";

const NATIVE_ROOT = fileURLToPath(new URL("../../native", import.meta.url));
const BINARY_NAME = `native.linux-${process.arch}-gnu.node`;
const CONFIG = 'export default { applicationId: "org.gtkx.nativeresolution", codegen: false };';

it.each(["source-built", "installed"] satisfies NativeLayout[])(
    "builds a runnable application from the %s native package",
    (layout) => {
        using project = createCliProject({
            prefix: "gtkx-native-resolution-",
            config: CONFIG,
            files: { "src/index.mjs": NATIVE_ENTRY },
            hasStore: true,
        });
        installNativePackage(project.root, layout);

        const entry = join(project.root, "src", "index.mjs");
        const direct = spawnSync(process.execPath, [entry], { cwd: project.root, encoding: "utf8" });
        expect(direct.status).toBe(0);

        const resolver = spawnSync(process.execPath, [
            "--no-addons", "--input-type=module", "--eval", 'import "@gtkx/native/internal/binding";',
        ], { cwd: project.root, encoding: "utf8" });
        expect(resolver.status).toBe(0);

        runCliOrThrow(project, ["build", entry]);
        expect(readFileSync(join(project.root, "dist", "gtkx.node"))).toEqual(
            readFileSync(join(NATIVE_ROOT, BINARY_NAME)),
        );

        rmSync(project.nodeModules, { recursive: true });
        const bundle = join(project.root, "dist", "bundle.mjs");
        const built = spawnSync(process.execPath, [bundle], { cwd: dirname(bundle), encoding: "utf8" });
        expect(built.status).toBe(0);
    },
);

it("rejects an application whose native package has no binary", () => {
    using project = createCliProject({
        prefix: "gtkx-native-resolution-missing-",
        config: CONFIG,
        files: { "src/index.mjs": NATIVE_ENTRY },
        hasStore: true,
    });
    installNativePackage(project.root, "missing");

    expect(runCli(project, ["build", join(project.root, "src", "index.mjs")]).status).not.toBe(0);
});
