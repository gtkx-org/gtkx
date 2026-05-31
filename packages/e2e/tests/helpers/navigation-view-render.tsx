import type * as Adw from "@gtkx/ffi/adw";
import { AdwNavigationView, GtkLabel } from "@gtkx/react";
import { waitFor } from "@gtkx/testing";
import type { ReactNode, RefObject } from "react";
import { expect } from "vitest";

/**
 * Renders the two `AdwNavigationView.Page` markers shared by the navigation
 * tests: pages `page1` and `page2`, titled `Page 1` and `Page 2`, each wrapping
 * a `GtkLabel` whose text is `${contentPrefix} 1` and `${contentPrefix} 2`.
 *
 * @param contentPrefix - Prefix for the label text of each page's content.
 */
export const TwoNavigationPages = ({ contentPrefix }: { contentPrefix: string }): ReactNode => (
    <>
        <AdwNavigationView.Page id="page1" title="Page 1">
            <GtkLabel label={`${contentPrefix} 1`} />
        </AdwNavigationView.Page>
        <AdwNavigationView.Page id="page2" title="Page 2">
            <GtkLabel label={`${contentPrefix} 2`} />
        </AdwNavigationView.Page>
    </>
);

/**
 * Waits for the navigation stack of the view behind `viewRef` to hold exactly
 * `size` items.
 *
 * @param viewRef - Ref to the `AdwNavigationView` under test.
 * @param size - Expected number of items in the navigation stack.
 */
export const expectNavigationStackSize = (viewRef: RefObject<Adw.NavigationView | null>, size: number): Promise<void> =>
    waitFor(() => {
        const stack = viewRef.current?.getNavigationStack();
        expect(stack?.getNItems()).toBe(size);
    });
