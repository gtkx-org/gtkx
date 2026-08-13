import { css, injectGlobal } from "@gtkx/css";
import { describe, expect, it } from "vitest";
import { probeMinWidth } from "./helpers/probe.js";

type MalformedCase = { kind: string; width: number; write: () => void };
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

describe("styles GTK4 parses whole", () => {
    it.each(KEPT)("installs $kind", async ({ className, width, write }) => {
        write();
        expect(await probeMinWidth([className])).toBeGreaterThanOrEqual(width);
    });
});
