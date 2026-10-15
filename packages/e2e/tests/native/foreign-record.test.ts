import * as Regress from "@gtkx/gi/regress";
import {
    compileDescriptor,
    call,
    bindFunction,
    createRecordConverter,
    type Descriptor,
    type ExternalObject,
    type Handle,
    openLibrary,
    type RecordConverter,
    type RecordConverterOptions,
    resolveSymbol,
} from "@gtkx/native";
import { getHandle, read, t } from "@gtkx/runtime";
import { expect, test } from "vitest";

const cairo = "libcairo.so.2";

const symbol = (library: string, name: string): ExternalObject<Handle> => {
    const target = resolveSymbol(openLibrary(library), name, false);
    if (target == null) {
        throw new Error(`Missing native function ${name}`);
    }
    return target;
};

const operations = (resolve: (name: string) => ExternalObject<Handle>): RecordConverterOptions => ({
    kind: "cairo-path",
    surfaceCreate: () => resolve("cairo_image_surface_create"),
    surfaceDestroy: () => resolve("cairo_surface_destroy"),
    contextCreate: () => resolve("cairo_create"),
    contextDestroy: () => resolve("cairo_destroy"),
    appendPath: () => resolve("cairo_append_path"),
    copyPath: () => resolve("cairo_copy_path"),
    contextStatus: () => resolve("cairo_status"),
    pathDestroy: () => resolve("cairo_path_destroy"),
});

const borrowedCopy = (
    copyConverter: ExternalObject<RecordConverter>,
    release: () => ExternalObject<Handle> = () => symbol(cairo, "cairo_path_destroy"),
): ((source: ExternalObject<Handle>) => ExternalObject<Handle>) => {
    const record: Descriptor = {
        kind: "struct",
        ownership: "borrowed",
        isCallerAllocated: false,
        isInline: false,
        isValueSafe: false,
        freeResolver: release,
        copyConverter,
    };
    const signature = bindFunction(
        [
            compileDescriptor({ kind: "buffer" }),
            compileDescriptor({ kind: "buffer" }),
            compileDescriptor({ kind: "biguint64", isDirectWord: false }),
        ],
        compileDescriptor(record),
        "borrowed path conversion",
        { argOrder: [0, 1, 2] },
    );
    const target = symbol("libc.so.6", "memmove");
    return (source) => call(signature, target, [source, source, 0n]).value as ExternalObject<Handle>;
};

test("native record copy operations resolve lazily and are retained for subsequent conversions", () => {
    const resolved: string[] = [];
    const copy = borrowedCopy(
        createRecordConverter(
            operations((name) => {
                resolved.push(name);
                return symbol(cairo, name);
            }),
        ),
    );
    expect(resolved).toEqual([]);
    const source = getHandle(Regress.testCairoPathFullReturn());
    const count = read(source, t.int32, 16);

    const first = copy(source);
    const second = copy(source);

    expect(read(first, t.int32, 0)).toBe(0);
    expect(read(first, t.int32, 16)).toBe(count);
    expect(read(second, t.int32, 16)).toBe(count);
    expect(read(source, t.int32, 0)).toBe(0);
    expect(resolved).toHaveLength(8);
    expect(new Set(resolved).size).toBe(8);
});

test("throwing record operation resolution preserves the exact exception and can be retried", () => {
    const failure = new Error("path operation unavailable");
    let failing = true;
    const copy = borrowedCopy(
        createRecordConverter(
            operations((name) => {
                if (name === "cairo_create" && failing) {
                    throw failure;
                }
                return symbol(cairo, name);
            }),
        ),
    );
    const source = getHandle(Regress.testCairoPathFullReturn());
    let thrown: unknown;
    try {
        copy(source);
    } catch (error) {
        thrown = error;
    }

    expect(thrown).toBe(failure);
    expect(read(source, t.int32, 0)).toBe(0);
    failing = false;
    expect(read(copy(source), t.int32, 0)).toBe(0);
});

test("native record conversion rejects an incompatible release operation without changing the source", () => {
    const copy = borrowedCopy(createRecordConverter(operations((name) => symbol(cairo, name))), () =>
        symbol("libglib-2.0.so.0", "g_free"),
    );
    const source = getHandle(Regress.testCairoPathFullReturn());

    expect(() => copy(source)).toThrow("declared native release operation");
    expect(read(source, t.int32, 0)).toBe(0);
});
