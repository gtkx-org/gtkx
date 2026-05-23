import { GtkScrolledWindow } from "@gtkx/react";
import type { ReactNode } from "react";

/** Props for {@link ScrollWrapper}. */
export interface ScrollWrapperProps {
    /** Widget subtree to place inside the scroll container. */
    children: ReactNode;
    /** Minimum content height in pixels (default 200). */
    minContentHeight?: number;
    /** Maximum content height in pixels. */
    maxContentHeight?: number;
    /** Minimum content width in pixels (default 200). */
    minContentWidth?: number;
}

/**
 * Sized scroll container that list, grid, and column views need so their
 * virtualized models realize enough rows for assertions to observe.
 */
export const ScrollWrapper = ({
    children,
    minContentHeight = 200,
    maxContentHeight,
    minContentWidth = 200,
}: ScrollWrapperProps): ReactNode => (
    <GtkScrolledWindow
        minContentHeight={minContentHeight}
        maxContentHeight={maxContentHeight}
        minContentWidth={minContentWidth}
    >
        {children}
    </GtkScrolledWindow>
);
