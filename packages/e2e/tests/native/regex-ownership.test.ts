import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import {
    alloc,
    bindFunction,
    call,
    compileDescriptor,
    type Descriptor,
    openLibrary,
    resolveSymbol,
} from "@gtkx/native";
import { fromNative, fromValue, getHandle, read, t, wrapHandle, write } from "@gtkx/runtime";
import { toValue } from "@gtkx/runtime/internal";
import { assert, expect, test } from "vitest";
import { drainGC } from "./helpers/memory.js";

const encoder = new TextEncoder();

const compile = (pattern: string): GLib.Regex => {
    const regex = GLib.Regex.new(pattern, 0, 0);
    if (regex === null) {
        throw new Error(`Could not compile regex ${pattern}`);
    }
    return regex;
};

const bindMatch = (subjectArgIndex?: number) =>
    t.fn("libglib-2.0.so.0", "g_regex_match_full", {
        args: [
            { type: t.boxed("GRegex") },
            { type: t.buffer },
            { type: t.int64 },
            { type: t.int32 },
            { type: t.uint32 },
            { type: t.matchInfo("full", subjectArgIndex), direction: "out" },
        ],
        returns: t.boolean,
        canThrow: true,
    });

const subjects: Record<string, (regex: GLib.Regex) => [boolean, GLib.MatchInfo]> = {
    string: (regex) => regex.matchFull("café 42", 0, 0),
    fragments: (regex) => regex.matchFull(["ca", "fé ", "42"], 0, 0),
    bytes: (regex) => {
        const input = encoder.encode("café 42");
        const result = regex.matchFull(input, 0, 0);
        input.fill(0);
        return result;
    },
    numbers: (regex) => regex.matchFull(Array.from(encoder.encode("café 42")), 0, 0),
};

test.each(Object.entries(subjects))("regex matches own their encoded %s input after collection", async (_, match) => {
    const [matched, info] = match(compile("(café) (\\d+)"));
    expect(matched).toBe(true);
    await drainGC();

    expect(info.fetchAll()).toEqual(["café 42", "café", "42"]);
    expect(info.getString()).toBe("café 42");
    expect(info.fetchPos(2)).toEqual([true, 6, 8]);
});

test("DFA matches retain their subject and empty input has native terminated storage", async () => {
    const [matched, info] = compile("a|ab").matchAllFull(["z", "ab"], 0, 0);
    const [emptyMatched, empty] = compile("^$").matchFull(new Uint8Array(), 0, 0);
    await drainGC();

    expect(matched).toBe(true);
    expect(info.fetchAll()).toEqual(["ab", "a"]);
    expect(emptyMatched).toBe(true);
    expect(empty.fetch(0)).toBe("");
});

test("replacement callbacks can retain their match and subject after returning to native", async () => {
    const retained: GLib.MatchInfo[] = [];
    const replaced = compile("\\d+").replaceEval("café 12 and 34", 0, 0, (info, result) => {
        expect(info.fetch(0)).toBe("12");
        retained.push(info);
        result.append(`[${info.fetch(0)}]`);
        return true;
    });
    await drainGC();

    expect(replaced).toBe("café [12] and 34");
    expect(retained).toHaveLength(1);
    for (const info of retained) {
        expect(info.getString()).toBe("café 12 and 34");
        expect(info.getRegex().getPattern()).toBe("\\d+");
    }
});

test.each(["boxed accessors", "descriptor"] as const)(
    "native value copies through %s retain a match after the original wrapper is collected",
    async (conversion) => {
        const copied = (() => {
            const [, info] = compile("(\\w+) (\\d+)").matchFull("first 12 second 34", 0, 0);
            const source =
                conversion === "descriptor"
                    ? wrapHandle(toValue(t.matchInfo(), info), GObject.Value)
                    : new GObject.Value();
            if (conversion === "boxed accessors") {
                source.init(GLib.MatchInfo);
                source.setBoxed(info);
            }
            const destination = new GObject.Value();
            destination.init(GLib.MatchInfo);
            source.copy(destination);
            source.unset();
            return destination;
        })();
        await drainGC();

        const info = conversion === "descriptor" ? fromValue(getHandle(copied)) : copied.getBoxed<GLib.MatchInfo>();
        assert(info instanceof GLib.MatchInfo);
        copied.unset();
        await drainGC();

        expect(info.getString()).toBe("first 12 second 34");
        expect(info.fetchAll()).toEqual(["first 12", "first", "12"]);
        expect(info.next()).toBe(true);
        expect(info.fetchAll()).toEqual(["second 34", "second", "34"]);
    },
);

test("nested replacement callbacks retain the subject of each invocation", async () => {
    const regex = compile("\\d+");
    const retained: Array<{ info: GLib.MatchInfo; subject: string }> = [];
    const replaced = regex.replaceEval("outer 12 and 34", 0, 0, (outer, result) => {
        retained.push({ info: outer, subject: "outer 12 and 34" });
        expect(outer.fetch(0)).toBe("12");
        const nested = regex.replaceEval("inner 56 and 78", 0, 0, (inner, nestedResult) => {
            retained.push({ info: inner, subject: "inner 56 and 78" });
            expect(inner.fetch(0)).toBe("56");
            nestedResult.append(`[${inner.fetch(0)}]`);
            return true;
        });
        expect(nested).toBe("inner [56] and 78");
        expect(outer.getString()).toBe("outer 12 and 34");
        result.append(`[${outer.fetch(0)}]`);
        return true;
    });
    await drainGC();

    expect(replaced).toBe("outer [12] and 34");
    expect(retained).toHaveLength(2);
    for (const { info, subject } of retained) {
        expect(info.getString()).toBe(subject);
        expect(info.getRegex().getPattern()).toBe("\\d+");
    }
});

test("replacement callback failures leave later matches with their own subject", async () => {
    const regex = compile("\\d+");
    const failure = new Error("replacement failed");
    const retained: Array<{ info: GLib.MatchInfo; subject: string }> = [];
    expect(() =>
        regex.replaceEval("failed 12", 0, 0, (info) => {
            retained.push({ info, subject: "failed 12" });
            throw failure;
        }),
    ).toThrow(failure);

    const replaced = regex.replaceEval("recovered 34", 0, 0, (info, result) => {
        retained.push({ info, subject: "recovered 34" });
        result.append(`[${info.fetch(0)}]`);
        return true;
    });
    await drainGC();

    expect(replaced).toBe("recovered [34]");
    expect(retained).toHaveLength(2);
    for (const { info, subject } of retained) {
        expect(info.getString()).toBe(subject);
    }
});

test("MatchInfo descriptors reject unowned and unterminated subjects before matching", () => {
    const match = bindMatch(1);
    const regex = getHandle(compile("a"));
    const subject = alloc(2);
    write(subject, t.uint8, 0, 97);

    expect(() => match(regex, regex, 1, 0, 0)).toThrow(/native-owned regex subject storage/);
    expect(() => match(regex, encoder.encode("a\0"), 1, 0, 0)).toThrow(/native-owned regex subject storage/);
    expect(() => match(regex, alloc(0), 0, 0, 0)).toThrow(/subject storage has no bounded bytes/);
    write(subject, t.uint8, 1, 1);
    expect(() => match(regex, subject, 1, 0, 0)).toThrow(/subject bytes must end with NUL/);

    write(subject, t.uint8, 1, 0);
    const [matched, info] = match(regex, subject, 1, 0, 0) as [boolean, GLib.MatchInfo];
    expect(matched).toBe(true);
    expect(info.fetch(0)).toBe("a");
});

test.each([0, 99])("MatchInfo descriptors reject subject argument index %s", (subjectArgIndex) => {
    const regex = getHandle(compile("a"));
    const subject = alloc(2);
    write(subject, t.uint8, 0, 97);

    expect(() => bindMatch(subjectArgIndex)(regex, subject, 1, 0, 0)).toThrow(/subject/i);
});

test("MatchInfo output decoding requires a retained subject and releases failed outputs", async () => {
    const regex = getHandle(compile("a"));
    const subject = alloc(2);
    write(subject, t.uint8, 0, 97);

    expect(() => bindMatch()(regex, subject, 1, 0, 0)).toThrow(/subject/i);
    await drainGC();

    const [matched, info] = bindMatch(1)(regex, subject, 1, 0, 0) as [boolean, GLib.MatchInfo];
    expect(matched).toBe(true);
    expect(info.getString()).toBe("a");
});

test("MatchInfo inputs preserve their subject when a native function returns another reference", async () => {
    const retain = t.fn("libglib-2.0.so.0", "g_match_info_ref", {
        args: [{ type: t.matchInfo() }],
        returns: t.matchInfo("full"),
    });
    const retained = (() => {
        const [, info] = compile("\\d+").match("retained 42", 0);
        return retain(getHandle(info)) as GLib.MatchInfo;
    })();
    await drainGC();

    expect(retained).toBeInstanceOf(GLib.MatchInfo);
    expect(retained.getString()).toBe("retained 42");
    expect(retained.fetch(0)).toBe("42");
    expect(() => retain(alloc(8))).toThrow(/MatchInfo/);
});

test.each(["array", "hash table"] as const)("MatchInfo %s descriptors reject escaping into native fields", (kind) => {
    const [, info] = compile("\\d+").match("retained 42", 0);
    const field = alloc(8);
    const descriptor =
        kind === "array" ? t.array(t.matchInfo(), "array", "full") : t.hashTable(t.int32, t.matchInfo(), "full");
    const contents = kind === "array" ? [getHandle(info)] : [[1, getHandle(info)]];

    expect(() => write(field, descriptor, 0, contents)).toThrow(/MatchInfo/);
    expect(read(field, t.struct(), 0)).toBeNull();
    expect(info.fetch(0)).toBe("42");
});

test("subject mutations during argument production are rejected before native matching", () => {
    const args: Descriptor[] = [
        { kind: "buffer" },
        { kind: "buffer" },
        { kind: "bigint64", isDirectWord: false },
        { kind: "int32" },
        { kind: "uint32" },
        {
            kind: "ref",
            innerDescriptor: { kind: "matchInfo", ownership: "full", subjectArgIndex: 1 },
            inout: false,
        },
        { kind: "buffer" },
    ];
    const signature = bindFunction(args.map(compileDescriptor), compileDescriptor({ kind: "int32" }), "regex match", {
        argOrder: args.map((_, index) => index),
    });
    const target = resolveSymbol(openLibrary("libglib-2.0.so.0"), "g_regex_match_full", false);
    assert(target != null);
    const subject = alloc(2);
    write(subject, t.uint8, 0, 97);
    const values = [getHandle(compile("a")), subject, 1n, 0, 0, { value: null }, null];

    expect(() =>
        call(signature, target, (index) => {
            if (index === 2) {
                compile("b").match("b", 0);
                write(subject, t.uint8, 1, 1);
            }
            return values[index];
        }),
    ).toThrow(/subject bytes must end with NUL/);

    write(subject, t.uint8, 1, 0);
    const result = call(signature, target, values);
    expect(result.value).toBe(1);
    const output = result.outputs.find((output) => output.index === 5);
    assert(output !== undefined);
    const info = fromNative(t.matchInfo(), output.value);
    assert(info instanceof GLib.MatchInfo);
    expect(info.fetch(0)).toBe("a");
});
