import { AdwNavigationPage } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";

/**
 * Renders the two `AdwNavigationPage` elements shared by the navigation tests:
 * pages tagged `page1` and `page2`, titled `Page 1` and `Page 2`, each wrapping
 * a `GtkLabel` whose text is `${contentPrefix} 1` and `${contentPrefix} 2`.
 *
 * @param contentPrefix - Prefix for the label text of each page's content.
 */
export const TwoNavigationPages = ({ contentPrefix }: { contentPrefix: string }): ReactNode => (
    <>
        <AdwNavigationPage tag="page1" title="Page 1">
            <GtkLabel label={`${contentPrefix} 1`} />
        </AdwNavigationPage>
        <AdwNavigationPage tag="page2" title="Page 2">
            <GtkLabel label={`${contentPrefix} 2`} />
        </AdwNavigationPage>
    </>
);
