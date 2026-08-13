import { describe, expect, it } from "vitest";
import { brokenToken } from "../src/tokens.js";

type Case = { kind: string; rule: string };

const UNTERMINATED = "leaves a string, comment or url unterminated";
const NEWLINE_IN_STRING = "carries a newline inside a string";

const WHOLE: Case[] = [
    { kind: "a rule that closes everything it opens", rule: ".a{color:rgb(0, 0, 255);}" },
    { kind: "a string that closes", rule: '.a{font-family:"Cantarell";}' },
    { kind: "an escaped quote inside a string", rule: String.raw`.a{font-family:"Cantarell\"";}` },
    { kind: "a comment that closes", rule: ".a{color:red;/* done */}" },
    { kind: "an unquoted url that closes", rule: ".a{--icon:url(https://x.dev/a/*b.png);}" },
    { kind: "an unquoted url padded with spaces", rule: ".a{--icon:url(  https://x.dev/a/*b.png  );}" },
    { kind: "an escaped closer inside an unquoted url", rule: String.raw`.a{--icon:url(a\)b.png);}` },
    { kind: "a quote inside an unquoted url", rule: '.a{--icon:url(https://x.dev/a"b.png);}' },
    { kind: "a closer inside a quoted url", rule: '.a{--icon:url("https://x.dev/a)b.png");}' },
    { kind: "a quoted url padded with spaces", rule: '.a{--icon:url(  "https://x.dev/a)b.png"  );}' },
    { kind: "an uppercase unquoted url", rule: ".a{--icon:URL(https://x.dev/a/*b.png);}" },
    { kind: "a comment opener inside a string", rule: '.a{font-family:"Canta/*rell";}' },
    { kind: "a quote inside a comment", rule: ".a{color:red;/* don't */}" },
    { kind: "a line continuation inside a string", rule: '.a{content:"Canta\\\nrell";}' },
    { kind: "an escape outside a string", rule: String.raw`.a\(b{color:red;}` },
    { kind: "a backslash left at the end", rule: ".a{color:red;}\\" },
    { kind: "nothing but whitespace", rule: " " },
    { kind: "an empty rule text", rule: "" },
];

const UNTERMINATED_CASES: Case[] = [
    { kind: "a string that never closes", rule: '.a{font-family:"Cantarell;}' },
    { kind: "a comment that never closes", rule: ".a{color:red;/*}" },
    { kind: "an unquoted url that never closes", rule: ".a{--icon:url(https://x.dev/a/*b.png;}" },
    { kind: "a quoted url whose string never closes", rule: '.a{--icon:url("a/*b);}' },
    { kind: "an escape that eats the closing quote", rule: String.raw`.a{font-family:"Cantarell\";}` },
    { kind: "a url left open behind an escape", rule: ".a{--icon:url(a\\" },
    { kind: "a string opened at the very end", rule: ".a{color:red;}'" },
];

const NEWLINE_CASES: Case[] = [
    { kind: "a newline inside a double quoted string", rule: '.a{content:"Canta\nrell";}' },
    { kind: "a newline inside a single quoted string", rule: ".a{content:'Canta\nrell';}" },
    { kind: "a newline inside a string that closes later", rule: ".a{content:'x\ny'z';}" },
];

describe("brokenToken", () => {
    it.each(WHOLE)("reads $kind whole", ({ rule }) => {
        expect(brokenToken(rule)).toBeNull();
    });

    it.each(UNTERMINATED_CASES)("reports $kind as unterminated", ({ rule }) => {
        expect(brokenToken(rule)).toBe(UNTERMINATED);
    });

    it.each(NEWLINE_CASES)("reports $kind as a newline inside a string", ({ rule }) => {
        expect(brokenToken(rule)).toBe(NEWLINE_IN_STRING);
    });
});
