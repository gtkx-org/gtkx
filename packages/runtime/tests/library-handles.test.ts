import { t } from "@gtkx/runtime";
import { execFile } from "node:child_process";
import { mkdtempDisposableSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const run = promisify(execFile);
const fixture = fileURLToPath(new URL("./fixtures/library-handles.ts", import.meta.url));
const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;

test("bound symbols use the first loadable candidate without searching later libraries", () => {
    const clock = t.bind("libgtkx-missing.so,libglib-2.0.so.0", "g_get_monotonic_time", [], t.bigint64);
    const absent = t.bind("libc.so.6,libglib-2.0.so.0", "g_get_monotonic_time", [], t.bigint64);

    expect(clock()).toBeGreaterThan(0n);
    expect(() => absent()).toThrow(/Failed to find symbol/);
    expect(() => absent()).toThrow(/Failed to find symbol/);
    expect(clock()).toBeGreaterThan(0n);
});

test("a loadable library does not inspect malformed later candidates", () => {
    const absolute = t.bind("libc.so.6,libgtkx-missing.so\0", "abs", [t.int32], t.int32);

    expect(absolute(-53)).toBe(53);
});

test.each(["\0suffix", "\0"])("bound symbol suffix %j is rejected on use", (suffix) => {
    const absolute = t.bind("libc.so.6", `abs${suffix}`, [t.int32], t.int32);

    expect(() => absolute(-7)).toThrow(/symbol.*NUL/i);
});

test.each(["libc.so.6\0suffix", "libc.so.6\0", "libgtkx-missing.so\0,libc.so.6"])(
    "malformed library name %j cannot select a fallback",
    (candidate) => {
        const absolute = t.bind(candidate, "abs", [t.int32], t.int32);

        expect(() => absolute(-7)).toThrow(/library.*NUL/i);
    },
);

test.each(["libgtkx-missing.so", "libc.so.6"])(
    "invalid signatures fail before resolving missing targets from %s",
    (library) => {
        expect(() => t.bind(library, "gtkx_missing_symbol", [], t.array(t.int32, "input"))).toThrow(
            /without an extent cannot be decoded/,
        );
        const absent = t.bind(library, "gtkx_missing_symbol", [], t.void);

        expect(() => absent()).toThrow(/Failed to (load library|find symbol)/);
    },
);

test("a failed lazy target can load a library that becomes available later", () => {
    const report = process.report.getReport();
    if (!("sharedObjects" in report) || !Array.isArray(report.sharedObjects)) {
        throw new Error("The process report must list loaded libraries");
    }
    const libc = report.sharedObjects.find(
        (path: unknown): path is string => typeof path === "string" && path.endsWith("/libc.so.6"),
    );
    if (libc === undefined) {
        throw new Error("The process must have loaded libc");
    }
    using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-library-handles-"));
    const candidate = join(directory.path, "late-library.so");
    const absolute = t.bind(candidate, "abs", [t.int32], t.int32);

    expect(() => absolute(-17)).toThrow(/Failed to load library/);
    symlinkSync(libc, candidate);

    expect(absolute(-17)).toBe(17);
    expect(absolute(-29)).toBe(29);
});

test("compiled and attached bindings remain executable across collection", async () => {
    const gc = globalThis.gc;
    if (gc === undefined) {
        throw new Error("Library handle tests require --expose-gc");
    }
    const pending = t.bind("libc.so.6", "abs", [t.int32], t.int32);
    const attached = t.bind("libm.so.6", "floor", [t.float64], t.float64);

    expect(attached(19.75)).toBe(19);
    await new Promise<void>((resolve) => setImmediate(resolve));
    gc();

    expect(pending(-41)).toBe(41);
    expect(attached(-8.25)).toBe(-9);
});

test("separate runtime environments reuse libraries after orderly worker shutdown", async () => {
    const result = await run(process.execPath, ["--import", loader, fixture], { timeout: 15_000 });

    expect(JSON.parse(result.stdout)).toEqual([
        { before: 31, after: 47, typeName: "GBytes", heldBefore: 23, heldAfter: 23 },
        { before: 31, after: 47, typeName: "GBytes", heldBefore: 23, heldAfter: 23 },
    ]);
}, 20_000);
