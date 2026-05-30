import type { ReactNode } from "react";
import { AdwNavigationSplitView as AdwNavigationSplitViewBase } from "../generated/compounds.js";
import type { AdwNavigationSplitViewProps, AdwNavigationViewProps } from "../generated/jsx.js";
import type { NavigationSplitViewPageProps, NavigationViewPageProps } from "../jsx.js";

const AdwNavigationViewElement = "AdwNavigationView" as const;
const NavigationPageElement = "NavigationPage" as const;

/**
 * Declarative wrapper for `Adw.NavigationView`.
 *
 * Use the `<AdwNavigationView.Page>` sub-component to declare pages; each
 * page's `id` is its navigation tag and its `title` the header title.
 *
 * @public
 */
export const AdwNavigationView: ((props: AdwNavigationViewProps) => ReactNode) & {
    /**
     * A page within an `<AdwNavigationView>`. The `id` serves as the page
     * tag used for navigation history.
     */
    Page: (props: NavigationViewPageProps) => ReactNode;
} = Object.assign((props: AdwNavigationViewProps): ReactNode => <AdwNavigationViewElement {...props} />, {
    Page: (props: NavigationViewPageProps): ReactNode => <NavigationPageElement for="AdwNavigationView" {...props} />,
});

/**
 * Declarative wrapper for `Adw.NavigationSplitView`.
 *
 * The `content` and `sidebar` slot props place a widget in the matching
 * pane directly. Alternatively, the `<AdwNavigationSplitView.Page>`
 * sub-component wraps a child in an `Adw.NavigationPage` whose `id`
 * (`"content"` or `"sidebar"`) selects the pane.
 *
 * @public
 */
export const AdwNavigationSplitView: ((props: AdwNavigationSplitViewProps) => ReactNode) & {
    /**
     * A page within an `<AdwNavigationSplitView>`. The `id` selects the
     * pane: `"content"` or `"sidebar"`.
     */
    Page: (props: NavigationSplitViewPageProps) => ReactNode;
} = Object.assign(AdwNavigationSplitViewBase, {
    Page: (props: NavigationSplitViewPageProps): ReactNode => (
        <NavigationPageElement for="AdwNavigationSplitView" {...props} />
    ),
});
