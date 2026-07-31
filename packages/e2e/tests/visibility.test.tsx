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

const capturedWidget = (held: Captured): Gtk.Widget => {
    if (!held.widget) {
        throw new Error("widget was never captured");
    }

    return held.widget;
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
        expect(capturedWidget(held)).toBeVisible();
        await rerender(activityTree("hidden", held));
        expect(capturedWidget(held)).not.toBeVisible();
        await rerender(activityTree("visible", held));
        expect(capturedWidget(held)).toBeVisible();
    });

    it("keeps an explicitly invisible widget hidden across an unhide cycle", async () => {
        const held: Captured = { widget: null };
        const { rerender } = await render(hiddenPanelTree("visible", held));
        expect(capturedWidget(held)).not.toBeVisible();
        await rerender(hiddenPanelTree("hidden", held));
        expect(capturedWidget(held)).not.toBeVisible();
        await rerender(hiddenPanelTree("visible", held));
        expect(capturedWidget(held)).not.toBeVisible();
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
        expect(capturedWidget(held)).toBeVisible();
        await rerender(tree(true));
        expect(capturedWidget(held)).not.toBeVisible();

        await act(async () => {
            deferred.resolve();
            await deferred.promise;
        });

        expect(capturedWidget(held)).toBeVisible();
    });
});
