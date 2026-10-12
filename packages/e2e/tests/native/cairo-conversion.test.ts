import * as Regress from "@gtkx/gi/regress";
import { getHandle, read, t } from "@gtkx/runtime";
import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { didSettle } from "./helpers/memory.js";

const directory = mkdtempSync(join(tmpdir(), "gtkx-cairo-conversion-"));
const library = join(directory, "libgtkx-cairo-conversion.so");
execFileSync(resolveExecutable("gcc"), [
    "-shared",
    "-fPIC",
    "-fsanitize=address",
    "-Wall",
    "-Wextra",
    "-Werror",
    join(import.meta.dirname, "fixtures/cairo-conversion.c"),
    "-o",
    library,
    "-ldl",
]);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const setFailure = t.bind(library, "gtkx_cairo_set_failure", [t.int32], t.void);
const activeOwners = t.bind(library, "gtkx_cairo_active_owners", [t.int32], t.int32);
const path = t.struct("borrowed", {
    sharedLibrary: library,
    freeFnName: "cairo_path_destroy",
    copyStrategy: "cairo-path",
});
const copy = t.bind("libc.so.6", "memmove", [t.buffer, t.buffer, t.biguint64], path);
const ownerCounts = (): unknown[] => [activeOwners(0), activeOwners(1), activeOwners(2)];

test.each([
    [1, "Cairo path copy failed with status 1"],
    [2, "Cairo path copy failed with status 1"],
    [3, "Cairo could not allocate a copy surface"],
    [4, "Cairo could not allocate a copy context"],
    [5, "Cairo could not allocate a path copy"],
] as const)("Cairo failure stage %i releases every acquired native owner before throwing", (stage, message) => {
    const source = getHandle(Regress.testCairoPathFullReturn());
    expect(ownerCounts()).toEqual([0, 0, 0]);
    setFailure(stage);
    try {
        expect(() => copy(source, source, 0n)).toThrow(message);
        expect(ownerCounts()).toEqual([0, 0, 0]);
        expect(read(source, t.int32, 0)).toBe(0);
    } finally {
        setFailure(0);
    }
});

test("successful Cairo conversion releases temporary owners and collects the owned path", async () => {
    const createCopy = (): void => {
        const source = getHandle(Regress.testCairoPathFullReturn());
        const copied = copy(source, source, 0n);
        expect(ownerCounts()).toEqual([0, 0, 1]);
        expect(copied).toBeDefined();
    };
    createCopy();
    expect(await didSettle(() => ownerCounts().every((count) => count === 0))).toBe(true);
});

test("failed argument preparation rolls back a converted transfer and preserves its source", () => {
    const destroy = t.bind(library, "cairo_path_destroy", [{ ...path, ownership: "full" }, t.int32], t.void);
    const source = getHandle(Regress.testCairoPathFullReturn());

    expect(() => destroy(source, "invalid integer")).toThrow();
    expect(ownerCounts()).toEqual([0, 0, 0]);
    expect(read(source, t.int32, 0)).toBe(0);
});
