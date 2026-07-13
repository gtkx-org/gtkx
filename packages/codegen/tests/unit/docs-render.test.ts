import { describe, expect, it } from "vitest";
import { docMarkdown, elementSlug, firstSentence } from "../../src/docs/render.js";

describe("elementSlug", () => {
    it("kebab-cases simple camel case names", () => {
        expect(elementSlug("Button")).toBe("button");
        expect(elementSlug("HeaderBar")).toBe("header-bar");
        expect(elementSlug("NavigationSplitView")).toBe("navigation-split-view");
    });

    it("keeps acronym runs together", () => {
        expect(elementSlug("ATContext")).toBe("at-context");
        expect(elementSlug("DBusConnection")).toBe("d-bus-connection");
        expect(elementSlug("GLArea")).toBe("gl-area");
    });
});

describe("docMarkdown", () => {
    it("returns an empty string for missing docs", () => {
        expect(docMarkdown(undefined)).toBe("");
        expect(docMarkdown("")).toBe("");
    });

    it("demotes headings so upstream docs nest under the page title", () => {
        expect(docMarkdown("# CSS nodes\n\nBody text")).toBe("## CSS nodes\n\nBody text");
        expect(docMarkdown("##### Deep\n\nBody")).toBe("###### Deep\n\nBody");
    });

    it("leaves heading-like lines inside code fences alone", () => {
        const doc = "Intro\n\n|[\n# not a heading\n]|";
        expect(docMarkdown(doc)).toContain("\n# not a heading\n");
    });

    it("strips picture, img, and video markup", () => {
        const doc = 'Before\n\n<picture>\n  <img src="button.png">\n</picture>\n\n<img alt="x" src="y.png">\n\nAfter';
        const result = docMarkdown(doc);
        expect(result).not.toContain("<picture");
        expect(result).not.toContain("<img");
        expect(result).toContain("Before");
        expect(result).toContain("After");
    });
});

describe("firstSentence", () => {
    it("takes the first sentence and strips markup", () => {
        expect(firstSentence("Shows a **bold** [link](https://example.com). More text follows.")).toBe(
            "Shows a bold link.",
        );
    });

    it("converts gtk-doc references to plain text", () => {
        expect(firstSentence("Uses %TRUE when @widget is shown. Second sentence.")).toBe(
            "Uses true when widget is shown.",
        );
    });

    it("falls back to the whole text when there is no sentence end", () => {
        expect(firstSentence("no terminal punctuation here")).toBe("no terminal punctuation here");
    });

    it("truncates very long sentences", () => {
        const sentence = `${"word ".repeat(60)}end.`;
        const result = firstSentence(sentence);
        expect(result.length).toBeLessThanOrEqual(220);
        expect(result.endsWith("...")).toBe(true);
    });
});
