import * as Regress from "@gtkx/gi/regress";
import { disposeHandle } from "@gtkx/native";
import { type ExternalObject, getHandle, type Handle, read, t } from "@gtkx/runtime";
import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";

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

test.each([1, 2])("Cairo failure stage %i releases every acquired native owner before throwing", (stage) => {
    const source = getHandle(Regress.testCairoPathFullReturn());
    expect(ownerCounts()).toEqual([0, 0, 0]);
    setFailure(stage);
    try {
        expect(() => copy(source, source, 0n)).toThrow("Cairo path copy failed with status 1");
        expect(ownerCounts()).toEqual([0, 0, 0]);
        expect(read(source, t.int32, 0)).toBe(0);
    } finally {
        setFailure(0);
        disposeHandle(source);
    }
});

test("successful Cairo conversion releases temporary owners and transfers one owned path", () => {
    const source = getHandle(Regress.testCairoPathFullReturn());
    const copied = copy(source, source, 0n) as ExternalObject<Handle>;
    expect(ownerCounts()).toEqual([0, 0, 1]);
    disposeHandle(copied);
    expect(ownerCounts()).toEqual([0, 0, 0]);
    disposeHandle(source);
});
