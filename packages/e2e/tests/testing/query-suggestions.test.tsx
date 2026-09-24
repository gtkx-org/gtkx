import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { type BoundQueries, getSuggestedQuery, render, screen, within } from "@gtkx/testing";
import { mkdtempDisposableSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const LABELS = ["Save", "Don't save", 'Use "quoted" names', String.raw`C:\tasks\new`, "Line one\nLine two"];

const loadSuggestion = async (
    widget: Gtk.Widget,
    method: "Role" | "Text",
): Promise<(queries: BoundQueries) => unknown> => {
    const suggestion = getSuggestedQuery(widget, "get", method);

    if (suggestion === undefined) {
        throw new Error("The widget did not produce a suggestion");
    }

    using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-query-suggestion-"));
    const file = join(temporary.path, "consumer.mjs");
    writeFileSync(file, `export default (Gtk, queries) => queries.${suggestion.toString()};`);
    const consumer = await import(pathToFileURL(file).href) as {
        default: (gtk: typeof Gtk, queries: BoundQueries) => unknown;
    };

    return (queries) => consumer.default(Gtk, queries);
};

describe("public query suggestions", () => {
    it.each(LABELS)("selects the same button through the suggested role query for %s", async (label) => {
        const { container } = await render(<GtkButton name="target" label={label} />);
        const target = screen.getByName("target");
        const query = await loadSuggestion(target, "Role");
        const result: unknown = query(within(container));
        expect(result).toBe(target);
    });

    it.each(LABELS)("selects the same label through the suggested text query for %s", async (label) => {
        const { container } = await render(<GtkLabel name="target" label={label} />);
        const target = screen.getByName("target");
        const query = await loadSuggestion(target, "Text");
        const result: unknown = query(within(container));
        expect(result).toBe(target);
    });

    it("suggests an unnamed button by role and has no label-only text suggestion for it", async () => {
        const { container } = await render(<GtkButton name="target" />);
        const target = screen.getByName("target");
        const query = await loadSuggestion(target, "Role");
        const result: unknown = query(within(container));
        expect(result).toBe(target);
        expect(getSuggestedQuery(target, "get", "Text")).toBeUndefined();
    });

    it("keeps a suggested single query's ambiguity error observable", async () => {
        const { container } = await render(
            <GtkBox>
                <GtkButton name="first" label="Don't save" />
                <GtkButton name="second" label="Don't save" />
            </GtkBox>,
        );
        const query = await loadSuggestion(screen.getByName("first"), "Role");
        expect(() => query(within(container))).toThrow();
    });
});
