import * as Gtk from "@gtkx/gi/gtk";
import { GtkEntry, GtkLabel, GtkWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { createRef, type ReactNode, useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { configure, getConfig, render, waitFor } from "../src/index.js";
import { withHostWindow, withStolenActivation } from "./widget-fixtures.js";

const RERENDER_BUDGET_MS = 250;
const IMPATIENT_SETTLE_MS = 20;
const APP_WINDOW_WIDTH = 200;
const APP_WINDOW_HEIGHT = 140;
const initialTimeout = getConfig().actionabilityTimeout;
const entryRef = createRef<Gtk.Entry>();

const SETTLE_FAILURE = new RegExp(
    `render timed out after ${String(IMPATIENT_SETTLE_MS)}ms waiting for the window it rendered into: ` +
    String.raw`it was never allocated a size\. Platform state such as focus is only readable once that window ` +
    String.raw`is allocated and active\.`,
);

const AutoFocusedEntry = (): ReactNode => {
    useEffect(() => {
        entryRef.current?.grabFocus();
    }, []);

    return <GtkEntry ref={entryRef} placeholderText="Search tasks" />;
};

const getActivation = (widget: Gtk.Widget): boolean | null =>
    widget instanceof Gtk.Window ? widget.isActive() : null;

const expectFocusedEntry = (): void => {
    const root = entryRef.current?.getRoot();
    expect(root instanceof Gtk.Window ? root.isActive() : null).toBe(true);
    expect(entryRef.current).toHaveFocus();
};

describe("render window activation", () => {
    it("reports a widget that grabs focus on mount as focused on the first render of a worker", async () => {
        await render(<AutoFocusedEntry />);
        expectFocusedEntry();
    });

    it("takes activation back from a toplevel holding it before resolving", async () => {
        await withStolenActivation(async () => {
            await render(<AutoFocusedEntry />);
            expectFocusedEntry();
        });
    });

    it("reports focus on mount when the tree presents its own window", async () => {
        await render(
            <GtkWindow title="App" defaultWidth={APP_WINDOW_WIDTH} defaultHeight={APP_WINDOW_HEIGHT}>
                <AutoFocusedEntry />
            </GtkWindow>,
            { container: rootElement },
        );

        expectFocusedEntry();
    });

    it("reports focus on mount when rendering into a window the caller presented", async () => {
        await withHostWindow(async (host, content) => {
            host.present();
            await render(<AutoFocusedEntry />, { container: content });
            expect(host.isActive()).toBe(true);
            expectFocusedEntry();
        });
    });
});

describe("rerender window activation", () => {
    it("waits for a window presented between renders before resolving a rerender", async () => {
        await withHostWindow(async (host, content) => {
            const { rerender } = await render(<GtkLabel>Before</GtkLabel>, { container: content });
            host.present();
            await rerender(<AutoFocusedEntry />);
            expect(host.getWidth()).toBeGreaterThan(0);
            expectFocusedEntry();
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

describe("render settle failures", () => {
    afterEach(() => {
        configure({ actionabilityTimeout: initialTimeout });
    });

    it("fails with the condition that kept the window from becoming readable", async () => {
        configure({ actionabilityTimeout: IMPATIENT_SETTLE_MS });

        await withHostWindow(async (host, content) => {
            host.present();

            await waitFor(() => {
                expect(host.isActive()).toBe(true);
            });

            host.setVisible(false);
            await expect(render(<GtkLabel>Unshown</GtkLabel>, { container: content })).rejects.toThrow(SETTLE_FAILURE);
        });
    });
});
