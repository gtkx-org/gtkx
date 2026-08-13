import { describe, expect, it } from "vitest";
import { isSelfContained } from "../src/self-contained.js";

type Case = { kind: string; rule: string };

const CONTAINED: Case[] = [
    { kind: "a rule that closes everything it opens", rule: ".a{color:rgb(0, 0, 255);}" },
    {
        kind: "nested blocks and functions",
        rule: "@media (prefers-color-scheme: dark){.a{color:alpha(@accent_bg_color, 0.4);}}",
    },
    { kind: "brackets inside a string", rule: '.a{font-family:"Cantarell{(";}' },
    { kind: "brackets inside a comment", rule: ".a{color:red;/* ) } */}" },
    { kind: "an escaped quote inside a string", rule: String.raw`.a{font-family:"Cantarell\"";}` },
    { kind: "an escaped opener outside a string", rule: String.raw`.a\(b{color:red;}` },
    { kind: "a comment opener inside an unquoted url", rule: ".a{--icon:url(https://x.dev/a/*b.png);}" },
    { kind: "a quote inside an unquoted url", rule: '.a{--icon:url(https://x.dev/a"b.png);}' },
    { kind: "an opener inside an unquoted url", rule: ".a{--icon:url(https://x.dev/a(b.png);}" },
    { kind: "an uppercase unquoted url", rule: ".a{--icon:URL(https://x.dev/a/*b.png);}" },
    { kind: "an unquoted url padded with spaces", rule: ".a{--icon:url(  https://x.dev/a/*b.png  );}" },
    { kind: "an escaped closer inside an unquoted url", rule: String.raw`.a{--icon:url(a\)b.png);}` },
    { kind: "a closer inside a quoted url", rule: '.a{--icon:url("https://x.dev/a)b.png");}' },
    { kind: "an at-rule statement", rule: "@define-color mine rgb(1, 2, 3);" },
    { kind: "an at-rule statement whose prelude carries brackets", rule: '@import url("theme.css");' },
    { kind: "a comment trailing a closed block", rule: ".a{color:red;}/* done */" },
    { kind: "a comment standing alone", rule: "/* nothing to see */" },
    { kind: "two rules handed over together", rule: ".a{color:red;}.b{color:blue;}" },
    { kind: "an at-rule followed by a rule", rule: "@define-color mine red;.a{color:@mine;}" },
    { kind: "nothing but whitespace", rule: " " },
];

const UNCONTAINED: Case[] = [
    { kind: "an unbalanced parenthesis", rule: ".a{color:rgb(0;}" },
    { kind: "an unterminated string", rule: '.a{font-family:"Cantarell;}' },
    { kind: "an unterminated comment", rule: ".a{color:red;/* }" },
    { kind: "a block that is never closed", rule: ".a{color:red;" },
    { kind: "a closer that matches nothing", rule: ".a{color:red;})" },
    { kind: "closers that arrive in the wrong order", rule: ".a{color:rgb(0, 0, 255};)" },
    { kind: "an unquoted url that never closes", rule: ".a{--icon:url(https://x.dev/a/*b.png;}" },
    { kind: "a comment opener inside a function named after a url", rule: ".a{--icon:myurl(a/*b);}" },
    { kind: "a comment opener inside a quoted url", rule: '.a{--icon:url("a/*b);}' },
    { kind: "a declaration with no selector around it", rule: "font-weight:bold;" },
    { kind: "a declaration that never reaches its semicolon", rule: "font-weight:bold" },
    { kind: "a stray semicolon after a closed block", rule: ".a{color:red;};" },
    { kind: "a selector left dangling after a closed block", rule: ".a{color:red;}.b" },
    { kind: "a prelude whose brackets close but whose block never opens", rule: ".a[b]" },
    { kind: "an at-rule statement that never reaches its semicolon", rule: "@define-color mine rgb(1, 2, 3)" },
    { kind: "a lone semicolon", rule: ";" },
];

describe("isSelfContained", () => {
    it.each(CONTAINED)("accepts $kind", ({ rule }) => {
        expect(isSelfContained(rule)).toBe(true);
    });

    it.each(UNCONTAINED)("rejects $kind", ({ rule }) => {
        expect(isSelfContained(rule)).toBe(false);
    });
});
