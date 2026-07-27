import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { act, render } from "@gtkx/testing";
import { Activity, type ReactNode, Suspense, use } from "react";
import { describe, expect, it } from "vitest";

type Captured = { widget: Gtk.Widget | null };
type DeferredPromise = { promise: Promise<string>; resolve: () => void };

const capturing =
    (held: Captured) =>
        (widget: Gtk.Widget | null): void => {
            if (widget) {
                held.widget = widget;
            }
        };

const isWidgetVisible = (held: Captured): boolean => {
    if (!held.widget) {
        throw new Error("widget was never captured");
    }

    return held.widget.getVisible();
};

const createDeferred = (): DeferredPromise => {
    const { promise, resolve } = Promise.withResolvers<string>();

    return { promise, resolve: () => {
        resolve("loaded");
    } };
};

const activityTree = (mode: "visible" | "hidden", held: Captured, isVisible = true): ReactNode => (
    <GtkBox>
        <Activity mode={mode}>
            <GtkLabel ref={capturing(held)} visible={isVisible}>
                Panel
            </GtkLabel>
        </Activity>
    </GtkBox>
);

const hiddenPanelTree = (mode: "visible" | "hidden", held: Captured): ReactNode => activityTree(mode, held, false);

describe("visibility", () => {
    it("hides and restores a mounted subtree with Activity", async () => {
        const held: Captured = { widget: null };
        const { rerender } = await render(activityTree("visible", held));
        expect(isWidgetVisible(held)).toBe(true);
        await rerender(activityTree("hidden", held));
        expect(isWidgetVisible(held)).toBe(false);
        await rerender(activityTree("visible", held));
        expect(isWidgetVisible(held)).toBe(true);
    });

    it("keeps an explicitly invisible widget hidden across an unhide cycle", async () => {
        const held: Captured = { widget: null };
        const { rerender } = await render(hiddenPanelTree("visible", held));
        expect(isWidgetVisible(held)).toBe(false);
        await rerender(hiddenPanelTree("hidden", held));
        expect(isWidgetVisible(held)).toBe(false);
        await rerender(hiddenPanelTree("visible", held));
        expect(isWidgetVisible(held)).toBe(false);
    });

    it("hides and restores a subtree that suspends after mount", async () => {
        const deferred = createDeferred();
        const held: Captured = { widget: null };
        const Deferred = (): ReactNode => <GtkLabel>{use(deferred.promise)}</GtkLabel>;

        const tree = (isPending: boolean): ReactNode => (
            <GtkBox>
                <Suspense fallback={<GtkLabel>Loading</GtkLabel>}>
                    <GtkLabel ref={capturing(held)}>Content</GtkLabel>
                    {isPending ? <Deferred /> : null}
                </Suspense>
            </GtkBox>
        );

        const { rerender } = await render(tree(false));
        expect(isWidgetVisible(held)).toBe(true);
        await rerender(tree(true));
        expect(isWidgetVisible(held)).toBe(false);

        await act(async () => {
            deferred.resolve();
            await deferred.promise;
        });

        expect(isWidgetVisible(held)).toBe(true);
    });
});
