import * as GLib from "@gtkx/gi/glib";
import { describe, expect, it } from "vitest";

const COMPILE_DEFAULT = GLib.RegexCompileFlags.DEFAULT;
const MATCH_DEFAULT = GLib.RegexMatchFlags.DEFAULT;

const churnAllocations = (): string | undefined => {
    const junk: string[] = [];

    for (let i = 0; i < 20_000; i++) {
        junk.push(`x${i.toString()}`.repeat(25));
    }

    return junk.at(-1);
};

describe("match info subject retention", () => {
    it("happy path", () => {
        const regex = GLib.Regex.new(String.raw`(?P<user>\w+)@(?P<host>\w+)`, COMPILE_DEFAULT, MATCH_DEFAULT);
        const [ok, info] = regex.match("hello@world", MATCH_DEFAULT);
        churnAllocations();
        expect(ok).toBe(true);
        expect(info.fetchAll()).toEqual(["hello@world", "hello", "world"]);
        expect(info.fetchNamed("user")).toBe("hello");
        expect(info.getString()).toBe("hello@world");

        const [allMatched, allInfo] = GLib.Regex.new("a+", COMPILE_DEFAULT, MATCH_DEFAULT).matchAll(
            "aaa",
            MATCH_DEFAULT,
        );
        churnAllocations();
        expect(allMatched).toBe(true);
        expect(allInfo.fetchAll()).toEqual(["aaa", "aa", "a"]);
    });

    it("edge cases", () => {
        const [matched, info] = GLib.Regex.new(String.raw`\w+`, COMPILE_DEFAULT, MATCH_DEFAULT).match(
            "one two three",
            MATCH_DEFAULT,
        );
        const words: (string | null)[] = [];
        let hasNext = matched;

        while (hasNext) {
            churnAllocations();
            words.push(info.fetch(0));
            hasNext = info.next();
        }

        expect(words).toEqual(["one", "two", "three"]);

        const [none, noMatch] = GLib.Regex.new(String.raw`\d+`, COMPILE_DEFAULT, MATCH_DEFAULT).match(
            "letters only",
            MATCH_DEFAULT,
        );
        churnAllocations();
        expect(none).toBe(false);
        expect(noMatch.fetch(0)).toBeNull();
        expect(noMatch.getString()).toBe("letters only");

        const [, unicode] = GLib.Regex.new("日本語", COMPILE_DEFAULT, MATCH_DEFAULT).match(
            "aé日本語",
            MATCH_DEFAULT,
        );
        churnAllocations();
        expect(unicode.fetchPos(0)).toEqual([true, 3, 12]);
    });

    it("error paths", () => {
        expect(() => GLib.Regex.new("(", COMPILE_DEFAULT, MATCH_DEFAULT)).toThrow();
    });
});
