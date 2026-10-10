import { execFile } from "node:child_process";
import {
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempDisposableSync,
    readFileSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const execute = promisify(execFile);
const workspace = fileURLToPath(new URL("../../..", import.meta.url));
const packageRoot = join(workspace, "packages/codegen");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
};

it("generates bindings from project configuration before renderer and native artifacts exist", async () => {
    using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-bindings-cli-"));
    const modules = join(directory.path, "node_modules");
    const codegen = join(modules, "@gtkx/codegen");
    mkdirSync(codegen, { recursive: true });
    copyFileSync(join(packageRoot, "package.json"), join(codegen, "package.json"));
    cpSync(join(packageRoot, "dist"), join(codegen, "dist"), { recursive: true });
    cpSync(join(packageRoot, "overrides"), join(codegen, "overrides"), { recursive: true });

    const unbuiltPackages = new Set(["@gtkx/react", "@gtkx/runtime", "@gtkx/native", "@gtkx/cairo"]);
    for (const name of new Set([...Object.keys(manifest.dependencies), "@gtkx/react", "react"])) {
        const destination = join(modules, name);
        mkdirSync(dirname(destination), { recursive: true });

        if (unbuiltPackages.has(name)) {
            mkdirSync(destination, { recursive: true });
            copyFileSync(
                join(workspace, "packages", name.slice("@gtkx/".length), "package.json"),
                join(destination, "package.json"),
            );
        } else {
            const source =
                name === "react" ? join(workspace, "node_modules", name) : join(packageRoot, "node_modules", name);
            symlinkSync(source, destination, "dir");
        }
    }

    writeFileSync(
        join(directory.path, "gtkx.config.base.ts"),
        'import { defineConfig } from "@gtkx/config"; export default defineConfig({ applicationId: "org.gtkx.bindings", libraries: ["Gio-2.0"] });',
    );
    const args = [join(codegen, "dist/cli.js"), "--cwd", directory.path, "--config", "gtkx.config.base.ts"];
    const first = await execute(process.execPath, args, { timeout: 60_000 });

    expect(first.stdout + first.stderr).toContain("regenerated bindings");
    expect(existsSync(join(modules, "@gtkx/gi/gio/index.d.ts"))).toBe(true);
    expect(existsSync(join(modules, "@gtkx/jsx/gtk/index.d.ts"))).toBe(true);
    expect(existsSync(join(directory.path, ".gtkx/reference"))).toBe(false);
    expect(existsSync(join(directory.path, "AGENTS.md"))).toBe(false);
    const second = await execute(process.execPath, args, { timeout: 60_000 });
    expect(second.stdout + second.stderr).toContain("bindings up to date");
});
