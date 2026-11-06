import { type Context, createContext, useContext } from "react";

const SplitViewCollapsedContext: Context<boolean | null> = createContext<boolean | null>(null);

/**
 * Returns whether the surrounding split view navigator shows one pane at a time, for its sidebar and content
 * screens. It follows the split view's `collapsed` property, so it holds for both the `collapsed` prop and
 * `collapseCondition`, and changes after libadwaita has laid out the collapsed or widened panes. Use it to
 * adapt a screen's presentation, such as switching an `AdwSidebar` to `Adw.SidebarMode.PAGE`.
 */
const useSplitViewCollapsed = (): boolean => {
    const isCollapsed = useContext(SplitViewCollapsedContext);

    if (isCollapsed === null) {
        throw new Error("useSplitViewCollapsed must be called inside a split view navigator.");
    }

    return isCollapsed;
};

export { SplitViewCollapsedContext, useSplitViewCollapsed };
