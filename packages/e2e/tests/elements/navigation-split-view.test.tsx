import type * as Adw from "@gtkx/gi/adw";
import { AdwNavigationPage, AdwNavigationSplitView } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - NavigationSplitView", () => {
    it("sets the content page", async () => {
        const viewRef = createRef<Adw.NavigationSplitView>();

        await render(
            <AdwNavigationSplitView ref={viewRef}>
                <AdwNavigationPage tag="content" title="Content">
                    <GtkLabel>Split Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationSplitView>,
        );

        await screen.findByText("Split Content");
        expect(viewRef.current?.getContent()?.getTag()).toBe("content");
    });

    it("clears the content page when unmounted", async () => {
        const viewRef = createRef<Adw.NavigationSplitView>();

        function App({ showContent }: { showContent: boolean }) {
            return (
                <AdwNavigationSplitView ref={viewRef}>
                    {showContent && (
                        <AdwNavigationPage tag="content" title="Content">
                            <GtkLabel>Split Content</GtkLabel>
                        </AdwNavigationPage>
                    )}
                </AdwNavigationSplitView>
            );
        }

        const { rerender } = await render(<App showContent={true} />);
        expect(viewRef.current?.getContent()).not.toBeNull();
        await rerender(<App showContent={false} />);
        expect(viewRef.current?.getContent()).toBeNull();
    });
});
