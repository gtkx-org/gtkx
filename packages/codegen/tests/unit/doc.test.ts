import { describe, expect, it } from "vitest";
import { renderJsDoc } from "../../src/writer/doc.js";

const ESCAPED_TERMINATOR = String.raw`*\/`;
const MEDIA_DOC = "Cap styles.\n\n<picture>\n  <img alt='Caps' src='caps.png'>\n</picture>";

const deprecatedBlock = (deprecated: { since: string | undefined; doc: string | undefined }): string =>
    renderJsDoc(undefined, undefined, { deprecated });

describe("renderJsDoc description and note", () => {
    it("renders nothing without a doc, a note or a spec", () => {
        expect(renderJsDoc(undefined)).toBe("");
        expect(renderJsDoc("")).toBe("");
        expect(renderJsDoc(undefined, undefined, {})).toBe("");
    });

    it("collapses a single-line description into one line", () => {
        expect(renderJsDoc("A widget.")).toBe("/** A widget. */\n");
    });

    it("separates the trailing note from the description with a blank line", () => {
        expect(renderJsDoc("A widget.", "Read-only.")).toBe("/**\n * A widget.\n *\n * Read-only.\n */\n");
    });

    it("uses the note alone when there is no description", () => {
        expect(renderJsDoc(undefined, "Read-only.")).toBe("/** Read-only. */\n");
    });

    it("strips media blocks from the description", () => {
        const rendered = renderJsDoc(MEDIA_DOC);
        expect(rendered).not.toContain("<picture");
        expect(rendered).not.toContain("<img");
        expect(rendered).toContain("Cap styles.");
    });

    it("passes the identifier map through to the description conversion", () => {
        const spec = { identifiers: new Map([["keyboard_mode", "keyboardMode"]]) };
        expect(renderJsDoc("Set @keyboard_mode.", undefined, spec)).toBe("/** Set `keyboardMode`. */\n");
    });
});

describe("renderJsDoc tags", () => {
    it("emits param tags in the given order after a blank line", () => {
        const spec = {
            params: [
                { name: "keyboardMode", doc: "whether the tooltip\nwas keyboard triggered" },
                { name: "tooltip", doc: "the tooltip" },
            ],
        };

        const expected = [
            "/**",
            " * Emitted on hover.",
            " *",
            " * @param keyboardMode whether the tooltip was keyboard triggered",
            " * @param tooltip the tooltip",
            " */",
            "",
        ].join("\n");

        expect(renderJsDoc("Emitted on hover.", undefined, spec)).toBe(expected);
    });

    it("drops params without prose", () => {
        expect(renderJsDoc(undefined, undefined, { params: [{ name: "a", doc: " " }] })).toBe("");
    });

    it("renders the returns, throws and since tags", () => {
        expect(renderJsDoc(undefined, undefined, { returns: "the child" })).toBe("/**\n * @returns the child\n */\n");

        expect(renderJsDoc(undefined, undefined, { throws: "GLib.Error on failure" })).toBe(
            "/**\n * @throws GLib.Error on failure\n */\n",
        );

        expect(renderJsDoc(undefined, undefined, { since: "4.10" })).toBe("/**\n * @since 4.10\n */\n");
    });

    it("keeps a multi-line returns tag on several lines", () => {
        expect(renderJsDoc(undefined, undefined, { returns: "a tuple of\n- the value\n- the offset" })).toBe(
            "/**\n * @returns a tuple of\n * - the value\n * - the offset\n */\n",
        );
    });
});

describe("renderJsDoc deprecation and escaping", () => {
    it("renders every deprecation shape", () => {
        expect(deprecatedBlock({ since: "4.10", doc: "Use [method@Gtk.Widget.set_child] instead." })).toBe(
            "/**\n * @deprecated Since 4.10. Use `Gtk.Widget.setChild()` instead.\n */\n",
        );

        expect(deprecatedBlock({ since: "4.10", doc: undefined })).toBe("/**\n * @deprecated Since 4.10.\n */\n");

        expect(deprecatedBlock({ since: undefined, doc: "Use something else." })).toBe(
            "/**\n * @deprecated Use something else.\n */\n",
        );

        expect(deprecatedBlock({ since: undefined, doc: undefined })).toBe("/**\n * @deprecated\n */\n");
    });

    it("orders the tag channel as params, returns, throws, deprecated and since", () => {
        const spec = {
            params: [{ name: "child", doc: "the child" }],
            returns: "nothing",
            throws: "GLib.Error",
            deprecated: { since: "4.10", doc: undefined },
            since: "4.0",
        };

        const expected = [
            "/**",
            " * @param child the child",
            " * @returns nothing",
            " * @throws GLib.Error",
            " * @deprecated Since 4.10.",
            " * @since 4.0",
            " */",
            "",
        ].join("\n");

        expect(renderJsDoc(undefined, undefined, spec)).toBe(expected);
    });

    it("escapes comment terminators in the description and in tag prose", () => {
        expect(renderJsDoc("ends */ here")).toBe(`/** ends ${ESCAPED_TERMINATOR} here */\n`);

        expect(renderJsDoc(undefined, undefined, { params: [{ name: "a", doc: "ends */ here" }] })).toBe(
            `/**\n * @param a ends ${ESCAPED_TERMINATOR} here\n */\n`,
        );
    });
});
