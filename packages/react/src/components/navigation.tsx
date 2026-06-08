import { AdwNavigationSplitView as AdwNavigationSplitViewBase } from "@gtkx/react-jsx/compounds";
import type { AdwNavigationSplitViewProps, AdwNavigationViewProps } from "@gtkx/react-jsx/jsx";
import type { ReactNode } from "react";
import type { NavigationSplitViewPageProps, NavigationViewPageProps } from "../jsx.js";
import { WRAPPER_NODE_ELEMENT } from "../nodes/wrapper.js";

const AdwNavigationViewElement = "AdwNavigationView" as const;
const WrapperNodeElement = WRAPPER_NODE_ELEMENT;

/**
 * Declarative wrapper for `Adw.NavigationView`.
 *
 * Use the `<AdwNavigationView.Page>` sub-component to declare pages; each
 * page's `id` is its navigation tag and its `title` the header title.
 *
 */
export const AdwNavigationView: ((props: AdwNavigationViewProps) => ReactNode) & {
    /**
     * A page within an `<AdwNavigationView>`. The `id` serves as the page
     * tag used for navigation history.
     */
    Page: (props: NavigationViewPageProps) => ReactNode;
} = Object.assign((props: AdwNavigationViewProps): ReactNode => <AdwNavigationViewElement {...props} />, {
    Page: (props: NavigationViewPageProps): ReactNode => (
        <WrapperNodeElement kind="wrap-then-add" for="AdwNavigationView" {...props} />
    ),
});

/**
 * Declarative wrapper for `Adw.NavigationSplitView`.
 *
 * The `content` and `sidebar` slot props place a widget in the matching
 * pane directly. Alternatively, the `<AdwNavigationSplitView.Page>`
 * sub-component wraps a child in an `Adw.NavigationPage` whose `id`
 * (`"content"` or `"sidebar"`) selects the pane.
 *
 */
export const AdwNavigationSplitView: ((props: AdwNavigationSplitViewProps) => ReactNode) & {
    /**
     * A page within an `<AdwNavigationSplitView>`. The `id` selects the
     * pane: `"content"` or `"sidebar"`.
     */
    Page: (props: NavigationSplitViewPageProps) => ReactNode;
} = Object.assign(AdwNavigationSplitViewBase, {
    Page: (props: NavigationSplitViewPageProps): ReactNode => (
        <WrapperNodeElement kind="wrap-then-add" for="AdwNavigationSplitView" {...props} />
    ),
});
