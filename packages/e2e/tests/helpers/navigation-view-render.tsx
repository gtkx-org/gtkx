import { AdwNavigationPage } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";

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
