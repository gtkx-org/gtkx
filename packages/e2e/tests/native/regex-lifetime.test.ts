import { MatchInfo, type String as NativeString, Regex, type RegexEvalCallback } from "@gtkx/gi/glib";
import { Value } from "@gtkx/gi/gobject";
import { assert, describe, expect, it } from "vitest";
import { didSettle, drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const MATCH_METHODS = ["match", "matchAll", "matchFull", "matchAllFull"] as const;
type MatchMethod = typeof MATCH_METHODS[number];

const encoder = new TextEncoder();
const BYTE_SUBJECTS = [
    { label: "byte subview", create: (text: string) => encoder.encode(`x${text}y`).subarray(1, -1) },
    { label: "number array", create: (text: string) => [...encoder.encode(text)] },
];

const match = (method: MatchMethod, subject: string): MatchInfo => {
    const regex = Regex.new("é+", 0, 0);
    assert(regex);

    return method === "match" || method === "matchAll"
        ? regex[method](subject, 0)[1]
        : regex[method](subject, 0, 0)[1];
};

const storeCopy = (info: MatchInfo): { value: Value; original: WeakRef<MatchInfo> } => {
    const source = new Value();
    source.init(MatchInfo);
    source.setBoxed(info);
    const value = new Value();
    value.init(MatchInfo);
    source.copy(value);
    source.unset();

    return { value, original: new WeakRef(info) };
};

const storeNested = (): { value: Value; original: WeakRef<MatchInfo> } => {
    const stored = storeCopy(match("match", "éé"));
    const value = new Value();
    value.init(Value);
    value.setBoxed(stored.value);
    stored.value.unset();

    return { value, original: stored.original };
};

const replaceAndStore = (
    replace: (regex: Regex, shouldStop: RegexEvalCallback) => string =
        (regex, shouldStop) => regex.replaceEval("é one two", 0, 0, shouldStop),
): {
    value: Value;
    original: WeakRef<MatchInfo>;
    builder: NativeString;
    result: string;
    words: string[];
} => {
    const regex = Regex.new("[a-z]+", 0, 0);
    assert(regex);
    let captured: { value: Value; original: WeakRef<MatchInfo>; builder: NativeString } | undefined;
    const words: string[] = [];
    const result = replace(regex, (info, builder) => {
        const word = info.fetch(0);
        assert(word !== null);
        words.push(word);
        builder.append(`[${word}]`);
        captured ??= { ...storeCopy(info), builder };

        return false;
    });
    assert(captured !== undefined);

    return { ...captured, result, words };
};

describe("regex match ownership through native values", () => {
    it.each(MATCH_METHODS)("%s retains text through a value copy after collection", async (method) => {
        const { value, original } = storeCopy(match(method, "head éé tail"));
        expect(await didSettle(() => original.deref() === undefined)).toBe(true);

        const alias = value.getBoxed<MatchInfo>();
        value.unset();
        expect(alias).toBeInstanceOf(MatchInfo);
        expect(alias.fetch(0)).toBe("éé");
        expect(alias.fetchPos(0)).toEqual([true, 5, 9]);
        expect(alias.getString()).toBe("head éé tail");
        expect(alias.getRegex().getPattern()).toBe("é+");
    });

    describe.each(BYTE_SUBJECTS)("$label ownership", ({ create }) => {
        it.each(["matchFull", "matchAllFull"] as const)("%s retains copied bytes after collection", async (method) => {
            const regex = Regex.new("é+", 0, 0);
            assert(regex);
            const subject = create("head éé tail");
            expect(() => regex[method](subject, 6, 0)).toThrow();
            const { value, original } = storeCopy(regex[method](subject, 0, 0)[1]);
            subject.fill(0);
            expect(await didSettle(() => original.deref() === undefined)).toBe(true);

            const alias = value.getBoxed<MatchInfo>();
            value.unset();
            expect(alias).toBeInstanceOf(MatchInfo);
            expect(alias.fetch(0)).toBe("éé");
            expect(alias.fetchPos(0)).toEqual([true, 5, 9]);
            expect(alias.getString()).toBe("head éé tail");
        });

        it("retains an empty byte subject through a native value", async () => {
            const regex = Regex.new("é+", 0, 0);
            assert(regex);
            const { value, original } = storeCopy(regex.matchFull(create(""), 0, 0)[1]);
            expect(await didSettle(() => original.deref() === undefined)).toBe(true);

            const alias = value.getBoxed<MatchInfo>();
            value.unset();
            expect(alias.matches()).toBe(false);
            expect(alias.fetch(0)).toBeNull();
            expect(alias.getString()).toBe("");
        });
    });

    it.each(["", "unmatched"])("retains an unmatched subject %j through a native value", async (subject) => {
        const { value, original } = storeCopy(match("match", subject));
        expect(await didSettle(() => original.deref() === undefined)).toBe(true);

        const alias = value.getBoxed<MatchInfo>();
        value.unset();
        expect(alias.matches()).toBe(false);
        expect(alias.fetch(0)).toBeNull();
        expect(alias.getString()).toBe(subject);
    });

    it("retains a match through nested native value copies", async () => {
        const { value, original } = storeNested();
        expect(await didSettle(() => original.deref() === undefined)).toBe(true);

        const nested = value.getBoxed<Value>();
        value.unset();
        const alias = nested.getBoxed<MatchInfo>();
        nested.unset();
        expect(alias.fetch(0)).toBe("éé");
        expect(alias.getString()).toBe("éé");
    });

    it("retains callback match text while the replacement builder remains scoped", async () => {
        const { value, original, builder, result, words } = replaceAndStore();
        expect(result).toBe("é [one] [two]");
        expect(words).toEqual(["one", "two"]);
        expect(() => builder.append("late")).toThrow();
        expect(await didSettle(() => original.deref() === undefined)).toBe(true);

        const alias = value.getBoxed<MatchInfo>();
        value.unset();
        expect(alias).toBeInstanceOf(MatchInfo);
        expect(alias.getString()).toBe("é one two");
        expect(alias.getRegex().getPattern()).toBe("[a-z]+");
    });

    it.each(BYTE_SUBJECTS)("retains $label callback text after collection", async ({ create }) => {
        const subject = create("é one two");
        const { value, original, builder, result, words } = replaceAndStore(
            (regex, shouldStop) => regex.replaceEval(subject, 0, 0, shouldStop),
        );
        subject.fill(0);
        expect(result).toBe("é [one] [two]");
        expect(words).toEqual(["one", "two"]);
        expect(() => builder.append("late")).toThrow();
        expect(await didSettle(() => original.deref() === undefined)).toBe(true);

        const alias = value.getBoxed<MatchInfo>();
        value.unset();
        expect(alias).toBeInstanceOf(MatchInfo);
        expect(alias.getString()).toBe("é one two");
        expect(alias.getRegex().getPattern()).toBe("[a-z]+");
    });

    it("recovers after an invalid byte offset and a throwing replacement callback", () => {
        const regex = Regex.new("é+", 0, 0);
        assert(regex);
        expect(() => regex.matchFull("éé", 1, 0)).toThrow();
        expect(() => regex.replaceEval("éé", 0, 0, () => {
            throw new Error("replacement failed");
        })).toThrow();
        expect(regex.replaceEval(["é", "é"], 0, 0, (info, builder) => {
            const text = info.fetch(0);
            assert(text !== null);
            builder.append(text);

            return false;
        })).toBe("éé");
        expect(regex.match("éé", 0)[1].fetch(0)).toBe("éé");
    });
});
