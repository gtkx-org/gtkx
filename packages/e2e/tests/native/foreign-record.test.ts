import {
    alloc,
    attachCall,
    call,
    compileCall,
    createFunctionResolver,
    createRecordConverter,
    type Descriptor,
    disposeHandle,
    type ExternalObject,
    type Handle,
    openLibrary,
    type RecordConverter,
    resolveSymbol,
} from "@gtkx/native";
import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";

const glib = "libglib-2.0.so.0";
const ownedDate = t.struct("full", { sharedLibrary: glib, freeFnName: "g_date_free" });
const newDate = t.bind(glib, "g_date_new_dmy", [t.uint8, t.int32, t.uint16], ownedDate);
const copyDate = t.bind(glib, "g_date_copy", [t.struct()], ownedDate);
const getDay = t.bind(glib, "g_date_get_day", [t.struct()], t.uint8);

const symbol = (library: string, name: string): ExternalObject<Handle> => {
    const target = resolveSymbol(openLibrary(library), name, false);
    if (target == null) {
        throw new Error(`Missing native function ${name}`);
    }
    return target;
};

const record = (
    copyConverter?: ExternalObject<RecordConverter>,
    ownership: "borrowed" | "full" = "borrowed",
): Descriptor => ({
    kind: "struct",
    ownership,
    isCallerAllocated: false,
    isInline: false,
    isValueSafe: false,
    freeResolver: createFunctionResolver(() => symbol(glib, "g_date_free")),
    ...(copyConverter === undefined ? {} : { copyConverter }),
});

const borrowedCopy = (converter: ExternalObject<RecordConverter>): ((source: unknown) => unknown) => {
    const signature = compileCall(
        [{ kind: "buffer" }, { kind: "buffer" }, { kind: "biguint64", isDirectWord: false }],
        record(converter),
        "borrowed date conversion",
        { argOrder: [0, 1, 2] },
    );
    const bound = attachCall(signature, symbol("libc.so.6", "memmove"));
    return (source) => call(bound, [source, source, 0n]).value;
};

test("record conversion consumes an owned result and expires its scoped source", () => {
    let borrowed: ExternalObject<Handle> | undefined;
    let converted: ExternalObject<Handle> | undefined;
    const convert = borrowedCopy(
        createRecordConverter((source) => {
            borrowed = source;
            converted = copyDate(source) as ExternalObject<Handle>;
            return converted;
        }),
    );
    const source = newDate(18, 7, 2000);
    const result = convert(source);

    expect(getDay(result)).toBe(18);
    expect(getDay(source)).toBe(18);
    expect(() => getDay(borrowed)).toThrow("only until that callback returns");
    expect(() => getDay(converted)).toThrow("only until that callback returns");
});

test("throwing record conversion preserves the exact exception and the original owner", () => {
    const failure = new Error("conversion failed");
    let borrowed: ExternalObject<Handle> | undefined;
    let failing = true;
    const convert = borrowedCopy(
        createRecordConverter((source) => {
            borrowed = source;
            if (failing) {
                throw failure;
            }
            return copyDate(source) as ExternalObject<Handle>;
        }),
    );
    const source = newDate(19, 7, 2000);

    let thrown: unknown;
    try {
        convert(source);
    } catch (error) {
        thrown = error;
    }
    expect(thrown).toBe(failure);
    expect(getDay(source)).toBe(19);
    expect(() => getDay(borrowed)).toThrow("only until that callback returns");
    failing = false;
    expect(getDay(convert(source))).toBe(19);
});

test("record conversions can reenter the same converter while retaining both sources", () => {
    let nested = false;
    const nestedCopies: unknown[] = [];
    const convert = borrowedCopy(
        createRecordConverter((source) => {
            if (!nested) {
                nested = true;
                try {
                    nestedCopies.push(convert(source));
                } finally {
                    nested = false;
                }
            }
            return copyDate(source) as ExternalObject<Handle>;
        }),
    );
    const source = newDate(20, 7, 2000);

    expect(getDay(convert(source))).toBe(20);
    expect(nestedCopies.map((copy) => getDay(copy))).toEqual([20]);
    expect(getDay(source)).toBe(20);
});

test("record conversion rejects borrowed results without consuming the source", () => {
    const convert = borrowedCopy(createRecordConverter((source) => source));
    const source = newDate(21, 7, 2000);

    expect(() => convert(source)).toThrow("must return an owned struct handle");
    expect(getDay(source)).toBe(21);
});

test("record conversion rejects incompatible destructors and retains the rejected owner", () => {
    const wrong = alloc(16);
    const convert = borrowedCopy(createRecordConverter(() => wrong));
    const source = newDate(22, 7, 2000);

    expect(() => convert(source)).toThrow("declared native release operation");
    expect(getDay(source)).toBe(22);
    disposeHandle(wrong);
    disposeHandle(wrong);
});

test("failed argument preparation rolls back a converted transfer and preserves its source", () => {
    let converted: ExternalObject<Handle> | undefined;
    const converter = createRecordConverter((source) => {
        converted = copyDate(source) as ExternalObject<Handle>;
        return converted;
    });
    const signature = compileCall(
        [record(converter, "full"), { kind: "int32" }],
        { kind: "void" },
        "conversion rollback",
        { argOrder: [0, 1] },
    );
    const bound = attachCall(signature, symbol(glib, "g_date_free"));
    const source = newDate(23, 7, 2000);

    expect(() => call(bound, [source, "invalid integer"])).toThrow();
    expect(getDay(source)).toBe(23);
    expect(() => getDay(converted)).toThrow("only until that callback returns");
});

test("a converter cannot dispose or transfer its captured source while native retains it", () => {
    const source = newDate(24, 7, 2000) as ExternalObject<Handle>;
    const disposalFailures: unknown[] = [];
    const convert = borrowedCopy(
        createRecordConverter((borrowed) => {
            try {
                disposeHandle(source);
            } catch (error) {
                disposalFailures.push(error);
            }
            return copyDate(borrowed) as ExternalObject<Handle>;
        }),
    );

    expect(getDay(convert(source))).toBe(24);
    expect(disposalFailures).toHaveLength(1);
    expect(String(disposalFailures[0])).toContain("active native operation cannot be disposed");
    const transferOriginal = borrowedCopy(createRecordConverter(() => source));
    expect(() => transferOriginal(source)).toThrow("active native operation cannot transfer ownership");
    expect(getDay(source)).toBe(24);
    disposeHandle(source);
    expect(() => getDay(source)).toThrow("only until that callback returns");
});

test("a borrowed output protects its captured owner even when that owner was not an argument", () => {
    const append = t.bind(
        glib,
        "g_list_append",
        [t.buffer, t.buffer],
        t.struct("full", { sharedLibrary: glib, freeFnName: "g_list_free" }),
    );
    const original = newDate(26, 7, 2000) as ExternalObject<Handle>;
    const container = append(null, original) as ExternalObject<Handle>;
    const converter = createRecordConverter((source) => {
        expect(() => disposeHandle(original)).toThrow("scoped conversion source cannot be disposed");
        return copyDate(source) as ExternalObject<Handle>;
    });
    const signature = compileCall(
        [{ kind: "buffer" }, { kind: "uint32" }],
        record(converter),
        "borrowed container data",
        { argOrder: [0, 1] },
    );
    const bound = attachCall(signature, symbol(glib, "g_list_nth_data"));

    expect(getDay(call(bound, [container, 0]).value)).toBe(26);
    expect(getDay(original)).toBe(26);
    disposeHandle(container);
    disposeHandle(original);
});

const list = (itemDescriptor: Descriptor, ownership: "borrowed" | "full"): Descriptor => ({
    kind: "array",
    arrayKind: "glist",
    ownership,
    elementOwnership: "separate",
    itemDescriptor,
    isBytes: false,
    isCallerAllocated: false,
    isZeroTerminated: false,
});

test("full callback returns convert a lent record before the callback source expires", () => {
    const converter = createRecordConverter((source) => copyDate(source) as ExternalObject<Handle>);
    const signature = compileCall(
        [
            list({ kind: "buffer" }, "borrowed"),
            {
                kind: "callback",
                argDescriptors: [record(), { kind: "buffer" }],
                returnDescriptor: record(converter, "full"),
                scope: "call",
                hasDestroy: false,
                destroyKind: "destroyNotify",
                hasUserData: true,
                userDataIndex: 1,
                canThrow: false,
                releaseWithCompletion: false,
            },
        ],
        list(record(undefined, "full"), "full"),
        "converted callback return",
        { argOrder: [0, 1, 2] },
    );
    const bound = attachCall(signature, symbol(glib, "g_list_copy_deep"));
    const original = newDate(25, 7, 2000);
    let callbackSource: ExternalObject<Handle> | undefined;
    const result = call(bound, [
        [original],
        (source: ExternalObject<Handle>) => {
            callbackSource = source;
            return source;
        },
    ]).value as unknown[];

    expect(result.map((copy) => getDay(copy))).toEqual([25]);
    expect(() => getDay(callbackSource)).toThrow("only until that callback returns");
    expect(getDay(original)).toBe(25);
});
