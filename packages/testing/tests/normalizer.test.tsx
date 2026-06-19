import { GtkLabel } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { getByText, getDefaultNormalizer, queryByText, render } from "../src/index.js";

describe("getDefaultNormalizer", () => {
    it("trims and collapses whitespace by default", () => {
        const normalize = getDefaultNormalizer();
        expect(normalize("  hello   world  ")).toBe("hello world");
    });

    it("can leave leading and trailing whitespace intact", () => {
        const normalize = getDefaultNormalizer({ trim: false });
        expect(normalize("  hello  ")).toBe(" hello ");
    });

    it("can preserve internal whitespace runs", () => {
        const normalize = getDefaultNormalizer({ collapseWhitespace: false });
        expect(normalize("  hello   world  ")).toBe("hello   world");
    });

    it("composes inside a custom normalizer", async () => {
        const { container } = await render(<GtkLabel label="HELLO   WORLD" />);
        const normalizer = (text: string) => getDefaultNormalizer()(text).toLowerCase();
        expect(getByText(container, "hello world", { normalizer })).toBeDefined();
    });
});

describe("normalizer guardrail", () => {
    it("rejects combining a custom normalizer with trim", async () => {
        const { container } = await render(<GtkLabel label="hello" />);
        expect(() => queryByText(container, "hello", { normalizer: (text) => text, trim: true })).toThrow(
            /trim and collapseWhitespace are not supported with a normalizer/,
        );
    });

    it("rejects combining a custom normalizer with collapseWhitespace", async () => {
        const { container } = await render(<GtkLabel label="hello" />);
        expect(() =>
            queryByText(container, "hello", { normalizer: (text) => text, collapseWhitespace: false }),
        ).toThrow(/trim and collapseWhitespace are not supported with a normalizer/);
    });

    it("accepts a custom normalizer on its own", async () => {
        const { container } = await render(<GtkLabel label="hello" />);
        expect(queryByText(container, "HELLO", { normalizer: (text) => text.toUpperCase() })).not.toBeNull();
    });
});
