import { css, injectGlobal } from "@gtkx/css";
import { describe, expect, it } from "vitest";
import { probeMinWidth } from "./helpers/probe.js";

type MalformedCase = { kind: string; width: number; write: () => void };
type DroppedCase = { kind: string; width: number; write: () => string };
type KeptCase = { kind: string; className: string; width: number; write: () => void };

const NUL = "\u{0}";
const AFTER_OFFSET = 100;

const MALFORMED: MalformedCase[] = [
    { kind: "a value that never closes its parenthesis", width: 201, write: () => css({ color: "rgb(0" }) },
    { kind: "a value that closes the rule early", width: 202, write: () => css({ color: "} font-weight:bold" }) },
    { kind: "an unterminated string", width: 203, write: () => css({ fontFamily: '"Cantarell' }) },
    { kind: "a newline inside a string", width: 204, write: () => css({ fontFamily: "'Canta\nrell'" }) },
    { kind: "an unclosed url", width: 205, write: () => css({ backgroundImage: "url(" }) },
    { kind: "a NUL byte", width: 206, write: () => css({ fontFamily: `"Canta${NUL}rell"` }) },
    { kind: "a comment opener inside a quoted url", width: 207, write: () => css({ backgroundImage: 'url("a/*b' }) },
    {
        kind: "declarations injected without a selector",
        width: 208,
        write: () => {
            injectGlobal({ color: "rgb(255, 0, 0)" });
        },
    },
    {
        kind: "a rule that forges the containment probe",
        width: 209,
        write: () => {
            injectGlobal(".gtkx-probe{color:rgb(0, 0, 0);background-image:url(}");
        },
    },
];

const DROPPED: DroppedCase[] = [
    {
        kind: "a newline inside a single-quoted string",
        width: 231,
        write: () => css({ minWidth: "231px", fontFamily: "'Canta\n{" }),
    },
    {
        kind: "a newline inside a double-quoted string",
        width: 232,
        write: () => css({ minWidth: "232px", fontFamily: '"Canta\n{' }),
    },
    {
        kind: "a carriage return inside a string",
        width: 233,
        write: () => css({ minWidth: "233px", fontFamily: "'Canta\r{" }),
    },
    {
        kind: "a form feed inside a string",
        width: 234,
        write: () => css({ minWidth: "234px", fontFamily: "'Canta\f{" }),
    },
];

const KEPT: KeptCase[] = [
    {
        kind: "an unquoted url carrying a comment opener",
        className: "gtkx-kept-url",
        width: 221,
        write: () => {
            injectGlobal(".gtkx-kept-url{--icon:url(https://x.dev/a/*b.png);min-width:221px;}");
        },
    },
    {
        kind: "brackets sitting inside a string",
        className: "gtkx-kept-quoted",
        width: 222,
        write: () => {
            injectGlobal('.gtkx-kept-quoted{font-family:"Cantarell{(";min-width:222px;}');
        },
    },
    {
        kind: "a newline escaped inside a string",
        className: "gtkx-kept-continued",
        width: 225,
        write: () => {
            injectGlobal('.gtkx-kept-continued{font-family:"Canta\\\nrell";min-width:225px;}');
        },
    },
    {
        kind: "a carriage return and newline escaped inside a string",
        className: "gtkx-kept-crlf",
        width: 226,
        write: () => {
            injectGlobal('.gtkx-kept-crlf{font-family:"Canta\\\r\nrell";min-width:226px;}');
        },
    },
    {
        kind: "a comment carrying a quote and a newline",
        className: "gtkx-kept-commented",
        width: 227,
        write: () => {
            injectGlobal(".gtkx-kept-commented{/* it's fine\n */min-width:227px;}");
        },
    },
    {
        kind: "a preserved comment carrying a quote and a newline",
        className: "gtkx-kept-bang",
        width: 228,
        write: () => {
            injectGlobal(".gtkx-kept-bang{/*! it's fine\n */min-width:228px;}");
        },
    },
    {
        kind: "a selector list",
        className: "gtkx-kept-listed",
        width: 223,
        write: () => {
            injectGlobal(".gtkx-kept-listed:hover,.gtkx-kept-listed{min-width:223px;}");
        },
    },
    {
        kind: "a descendant selector",
        className: "gtkx-kept-nested",
        width: 224,
        write: () => {
            injectGlobal("window .gtkx-kept-nested{min-width:224px;}");
        },
    },
];

describe("styles GTK4 would not parse whole", () => {
    it.each(MALFORMED)("keeps the styles written around $kind", async ({ width, write }) => {
        const before = css({ minWidth: `${String(width)}px` });
        write();
        const after = css({ minWidth: `${String(width + AFTER_OFFSET)}px` });
        expect(await probeMinWidth([before])).toBeGreaterThanOrEqual(width);
        expect(await probeMinWidth([after])).toBeGreaterThanOrEqual(width + AFTER_OFFSET);
    });
});

describe("styles GTK4 parses with an error it recovers from", () => {
    it.each(DROPPED)("drops the whole rule carrying $kind", async ({ width, write }) => {
        expect(await probeMinWidth([write()])).toBeLessThan(width);
    });
});

describe("styles GTK4 parses whole", () => {
    it.each(KEPT)("installs $kind", async ({ className, width, write }) => {
        write();
        expect(await probeMinWidth([className])).toBeGreaterThanOrEqual(width);
    });
});
