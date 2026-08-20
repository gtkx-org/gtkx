import * as GLib from "@gtkx/gi/glib";
import { describe, expect, it } from "vitest";

const COMPILE_DEFAULT = GLib.RegexCompileFlags.DEFAULT;
const MATCH_DEFAULT = GLib.RegexMatchFlags.DEFAULT;

const churnAllocations = (): number => {
    const junk: string[] = [];

    for (let i = 0; i < 20_000; i++) {
        junk.push(`x${i.toString()}`.repeat(25));
    }

    return junk.length;
};

describe("match info subject retention", () => {
    it("fetches match text after heavy allocation churn", () => {
        const regex = GLib.Regex.new(String.raw`(?P<user>\w+)@(?P<host>\w+)`, COMPILE_DEFAULT, MATCH_DEFAULT);
        const [ok, info] = regex.match("hello@world", MATCH_DEFAULT);
        expect(ok).toBe(true);
        expect(churnAllocations()).toBeGreaterThan(0);
        expect(info.fetch(0)).toBe("hello@world");
        expect(info.fetch(1)).toBe("hello");
        expect(info.fetch(2)).toBe("world");
        expect(info.fetchAll()).toEqual(["hello@world", "hello", "world"]);
        expect(info.fetchNamed("user")).toBe("hello");
        expect(info.fetchNamed("host")).toBe("world");
        expect(info.getString()).toBe("hello@world");
    });

    it("iterates all matches with next", () => {
        const regex = GLib.Regex.new(String.raw`\w+`, COMPILE_DEFAULT, MATCH_DEFAULT);
        const [ok, info] = regex.match("one two three", MATCH_DEFAULT);
        const words: (string | null)[] = [];
        let isMatched = ok;

        while (isMatched) {
            expect(churnAllocations()).toBeGreaterThan(0);
            words.push(info.fetch(0));
            isMatched = info.next();
        }

        expect(words).toEqual(["one", "two", "three"]);
    });

    it("scans from a byte offset with matchFull", () => {
        const regex = GLib.Regex.new(String.raw`\w+`, COMPILE_DEFAULT, MATCH_DEFAULT);
        const [ok, info] = regex.matchFull("foo bar", 4, MATCH_DEFAULT);
        expect(ok).toBe(true);
        expect(churnAllocations()).toBeGreaterThan(0);
        expect(info.fetch(0)).toBe("bar");
    });
});

describe("match all subject retention", () => {
    it("retrieves overlapping matches with matchAll", () => {
        const regex = GLib.Regex.new("a+", COMPILE_DEFAULT, MATCH_DEFAULT);
        const [ok, info] = regex.matchAll("aaa", MATCH_DEFAULT);
        expect(ok).toBe(true);
        expect(churnAllocations()).toBeGreaterThan(0);
        expect(info.getMatchCount()).toBe(3);
        expect(info.fetch(0)).toBe("aaa");
        expect(info.fetch(1)).toBe("aa");
        expect(info.fetch(2)).toBe("a");
    });

    it("retrieves overlapping matches from an offset with matchAllFull", () => {
        const regex = GLib.Regex.new("b+", COMPILE_DEFAULT, MATCH_DEFAULT);
        const [ok, info] = regex.matchAllFull("abbb", 1, MATCH_DEFAULT);
        expect(ok).toBe(true);
        expect(churnAllocations()).toBeGreaterThan(0);
        expect(info.fetch(0)).toBe("bbb");
    });
});

describe("match info edge cases", () => {
    it("reports no match without corrupting the subject", () => {
        const regex = GLib.Regex.new(String.raw`\d+`, COMPILE_DEFAULT, MATCH_DEFAULT);
        const [ok, info] = regex.match("letters only", MATCH_DEFAULT);
        expect(ok).toBe(false);
        expect(churnAllocations()).toBeGreaterThan(0);
        expect(info.matches()).toBe(false);
        expect(info.fetch(0)).toBeNull();
        expect(info.getString()).toBe("letters only");
    });

    it("matches an empty subject", () => {
        const regex = GLib.Regex.new("a?", COMPILE_DEFAULT, MATCH_DEFAULT);
        const [ok, info] = regex.match("", MATCH_DEFAULT);
        expect(ok).toBe(true);
        expect(churnAllocations()).toBeGreaterThan(0);
        expect(info.fetch(0)).toBe("");
        expect(info.getString()).toBe("");
    });

    it("matches multi-byte text at byte positions", () => {
        const regex = GLib.Regex.new("日本語", COMPILE_DEFAULT, MATCH_DEFAULT);
        const [ok, info] = regex.match("aé日本語", MATCH_DEFAULT);
        expect(ok).toBe(true);
        expect(churnAllocations()).toBeGreaterThan(0);
        expect(info.fetch(0)).toBe("日本語");
        expect(info.fetchPos(0)).toEqual([true, 3, 12]);
        expect(info.getString()).toBe("aé日本語");
    });

    it("accepts the array-of-strings subject form", () => {
        const regex = GLib.Regex.new(String.raw`(\w+)@(\w+)`, COMPILE_DEFAULT, MATCH_DEFAULT);
        const [ok, info] = regex.matchFull(["hello@world"], 0, MATCH_DEFAULT);
        expect(ok).toBe(true);
        expect(churnAllocations()).toBeGreaterThan(0);
        expect(info.fetch(1)).toBe("hello");
    });
});

describe("regex error paths", () => {
    it("throws on an invalid pattern", () => {
        expect(() => GLib.Regex.new("(", COMPILE_DEFAULT, MATCH_DEFAULT)).toThrow();
    });
});
