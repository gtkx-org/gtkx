import * as Gtk from "@gtkx/gi/gtk";
import { GtkEntry, GtkLabel } from "@gtkx/jsx/gtk";
import { createRef, type ReactNode, useEffect } from "react";
import { describe, expect, it } from "vitest";
import { type Container, render, waitFor } from "../src/index.js";
import { withStolenActivation } from "./widget-fixtures.js";

const RERENDER_BUDGET_MS = 250;
const entryRef = createRef<Gtk.Entry>();

const AutoFocusedEntry = (): ReactNode => {
    useEffect(() => {
        entryRef.current?.grabFocus();
    }, []);

    return <GtkEntry ref={entryRef} placeholderText="Search tasks" />;
};

const getActivation = (container: Container): boolean | null =>
    container instanceof Gtk.Window ? container.isActive() : null;

const expectFocusedEntry = (container: Container): void => {
    expect(getActivation(container)).toBe(true);
    expect(entryRef.current).toHaveFocus();
};

describe("render window activation", () => {
    it("reports a widget that grabs focus on mount as focused on the first render of a worker", async () => {
        const { container } = await render(<AutoFocusedEntry />);
        expectFocusedEntry(container);
    });

    it("takes activation back from a toplevel holding it before resolving", async () => {
        await withStolenActivation(async () => {
            const { container } = await render(<AutoFocusedEntry />);
            expectFocusedEntry(container);
        });
    });

    it("rerenders without waiting for activation another toplevel holds", async () => {
        const { container, findByText, rerender } = await render(<GtkLabel>Before</GtkLabel>);

        await withStolenActivation(async () => {
            await waitFor(() => {
                expect(getActivation(container)).toBe(false);
            });

            const startedAt = Date.now();
            await rerender(<GtkLabel>After</GtkLabel>);
            expect(Date.now() - startedAt).toBeLessThan(RERENDER_BUDGET_MS);
        });

        expect(await findByText("After")).toBeDefined();
    });
});
