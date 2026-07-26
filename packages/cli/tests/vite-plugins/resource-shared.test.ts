import { describe, expect, it } from "vitest";
import { escapeXml } from "../../src/vite-plugins/resource-shared.js";

describe("escapeXml (internal)", () => {
    it("escapes < to &lt;", () => {
        expect(escapeXml("<root>")).toBe("&lt;root&gt;");
    });

    it("escapes & to &amp;", () => {
        expect(escapeXml("a & b")).toBe("a &amp; b");
    });

    it("escapes the double quote to &quot;", () => {
        expect(escapeXml('say "hi"')).toBe("say &quot;hi&quot;");
    });

    it("escapes the apostrophe to &apos;", () => {
        expect(escapeXml("it's")).toBe("it&apos;s");
    });

    it("leaves a plain alphanumeric string untouched", () => {
        expect(escapeXml("plain text 123")).toBe("plain text 123");
    });

    it("escapes a string containing every reserved character", () => {
        expect(escapeXml("<a & b=\"c\">'")).toBe("&lt;a &amp; b=&quot;c&quot;&gt;&apos;");
    });
});
