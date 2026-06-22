import type { Element } from "stylis";
import { describe, expect, it } from "vitest";
import {
    AT_RULE_KEYWORDS,
    escapeNamedColors,
    NAMED_COLOR_TOKEN,
    removeLabel,
    restoreNamedColors,
} from "../src/stylis-extensions.js";

const declElement = (value: string): Element => ({
    parent: null,
    children: "",
    root: null,
    type: "decl",
    props: "",
    value,
    length: value.length,
    return: `${value};`,
    line: 0,
    column: 0,
});

describe("escapeNamedColors / restoreNamedColors", () => {
    it("tokenizes a GTK named color and restores it round-trip", () => {
        const escaped = escapeNamedColors("color:@theme_fg_color;");
        expect(escaped).toBe(`color:${NAMED_COLOR_TOKEN}theme_fg_color;`);
        expect(restoreNamedColors(escaped)).toBe("color:@theme_fg_color;");
    });

    it("leaves allow-listed at-rules untouched", () => {
        for (const keyword of AT_RULE_KEYWORDS) {
            const source = `@${keyword} {}`;
            expect(escapeNamedColors(source)).toBe(source);
        }
    });

    it("tokenizes multiple named colors in a single declaration", () => {
        const escaped = escapeNamedColors("box-shadow:0 0 0 1px alpha(@accent_bg_color, 0.4), @borders;");
        expect(escaped).toBe(
            `box-shadow:0 0 0 1px alpha(${NAMED_COLOR_TOKEN}accent_bg_color, 0.4), ${NAMED_COLOR_TOKEN}borders;`,
        );
        expect(restoreNamedColors(escaped)).toBe("box-shadow:0 0 0 1px alpha(@accent_bg_color, 0.4), @borders;");
    });

    it("tokenizes an at-rule that is not in the allow-list, corrupting its structure", () => {
        const escaped = escapeNamedColors("@layer base { color: red; }");
        expect(escaped).toBe(`${NAMED_COLOR_TOKEN}layer base { color: red; }`);
        expect(escaped).not.toContain("@layer");
    });

    it("tokenizes @property because it is not in the allow-list", () => {
        const escaped = escapeNamedColors("@property --x {}");
        expect(escaped).toBe(`${NAMED_COLOR_TOKEN}property --x {}`);
        expect(escaped).not.toContain("@property");
    });
});

describe("removeLabel", () => {
    it("clears a label declaration", () => {
        const element = declElement("label:btn");
        removeLabel(element);
        expect(element.value).toBe("");
        expect(element.return).toBe("");
    });

    it("leaves a non-label declaration intact", () => {
        const element = declElement("padding:8px");
        removeLabel(element);
        expect(element.value).toBe("padding:8px");
        expect(element.return).toBe("padding:8px;");
    });
});
