import type { ReactNode } from "react";
import { AdwNavigationPage } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";

const TwoNavigationPages = ({ contentPrefix }: { contentPrefix: string }): ReactNode => (
    <>
        <AdwNavigationPage tag="page1" title="Page 1">
            <GtkLabel>{`${contentPrefix} 1`}</GtkLabel>
        </AdwNavigationPage>
        <AdwNavigationPage tag="page2" title="Page 2">
            <GtkLabel>{`${contentPrefix} 2`}</GtkLabel>
        </AdwNavigationPage>
    </>
);

export { TwoNavigationPages };
