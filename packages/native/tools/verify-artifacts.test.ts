import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempDisposableSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test("native release builds restore only checksum-verified staged artifacts", () => {
    using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-native-release-"));
    const artifacts = join(directory.path, "artifacts");
    mkdirSync(artifacts);
    const platform = `linux-${process.arch}-gnu`;
    const files = new Map([
        [`native.${platform}.node`, "staged native binary"],
        [`index.${platform}.js`, "export const staged = true;"],
        [`index.${platform}.d.ts`, "export declare const staged: true;"],
    ]);

    for (const [name, contents] of files) {
        writeFileSync(join(artifacts, name), contents);
        const checksum = createHash("sha256").update(contents).digest("hex");
        writeFileSync(join(artifacts, `${name}.sha256`), `${checksum}  ${name}\n`);
    }

    const build = (...args: string[]) =>
        spawnSync(process.execPath, [fileURLToPath(new URL("./build.ts", import.meta.url)), ...args], {
            cwd: directory.path,
            encoding: "utf8",
            timeout: 10_000,
        });

    const restored = build("--from-artifacts");
    expect(restored.status).toBe(0);
    expect(readFileSync(join(directory.path, `native.${platform}.node`), "utf8")).toBe(
        files.get(`native.${platform}.node`),
    );
    expect(readFileSync(join(directory.path, "index.js"), "utf8")).toBe(files.get(`index.${platform}.js`));
    expect(readFileSync(join(directory.path, "index.d.ts"), "utf8")).toBe(files.get(`index.${platform}.d.ts`));

    writeFileSync(join(artifacts, `index.${platform}.js`), "corrupt artifact");
    const corrupted = build("--from-artifacts");
    expect(corrupted.status).not.toBe(0);
    expect(corrupted.stderr).toMatch(/checksum mismatch/);
    expect(readFileSync(join(directory.path, "index.js"), "utf8")).toBe(files.get(`index.${platform}.js`));

    const withBuildFlags = build("--from-artifacts", "--debug");
    expect(withBuildFlags.status).not.toBe(0);
    expect(withBuildFlags.stderr).toMatch(/cannot accept build arguments/);
});
