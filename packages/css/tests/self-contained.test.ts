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
];

const UNCONTAINED: Case[] = [
    { kind: "an unbalanced parenthesis", rule: ".a{color:rgb(0;}" },
    { kind: "an unterminated string", rule: '.a{font-family:"Cantarell;}' },
    { kind: "an unterminated comment", rule: ".a{color:red;/* }" },
    { kind: "a block that is never closed", rule: ".a{color:red;" },
    { kind: "a closer that matches nothing", rule: ".a{color:red;})" },
    { kind: "closers that arrive in the wrong order", rule: ".a{color:rgb(0, 0, 255};)" },
];

describe("isSelfContained", () => {
    it.each(CONTAINED)("accepts $kind", ({ rule }) => {
        expect(isSelfContained(rule)).toBe(true);
    });

    it.each(UNCONTAINED)("rejects $kind", ({ rule }) => {
        expect(isSelfContained(rule)).toBe(false);
    });
});
