import * as GLib from "@gtkx/gi/glib";
import { alloc, createMatchSubject, getMatchInfoBase, ownMatchInfo } from "@gtkx/native";
import { getHandle, t, write } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainGC } from "./helpers/memory.js";

const encoder = new TextEncoder();

const compile = (pattern: string): GLib.Regex => {
    const regex = GLib.Regex.new(pattern, 0, 0);
    if (regex === null) {
        throw new Error(`Could not compile regex ${pattern}`);
    }
    return regex;
};

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

test("match ownership rejects unrelated, unterminated, and incorrectly typed native storage", () => {
    const [, info] = compile("a").match("a", 0);
    const raw = getMatchInfoBase(getHandle(info));
    const subject = createMatchSubject(encoder.encode("a"));

    expect(() => ownMatchInfo(raw, alloc(2))).toThrow("native-owned regex subject storage");
    expect(() => ownMatchInfo(raw, subject)).toThrow("does not reference the supplied subject bytes");
    expect(() => ownMatchInfo(alloc(8), subject)).toThrow("Expected a boxed or call-scoped GMatchInfo handle");
    write(subject, t.uint8, 1, 1);
    expect(() => ownMatchInfo(raw, subject)).toThrow("subject bytes must end with NUL");
    expect(info.fetch(0)).toBe("a");
});
