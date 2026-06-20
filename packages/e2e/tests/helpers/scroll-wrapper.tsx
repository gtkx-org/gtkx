import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";

export interface ScrollWrapperProps {
    children: ReactNode;
    minContentHeight?: number | undefined;
    maxContentHeight?: number | undefined;
    minContentWidth?: number | undefined;
    insertActionGroup?: ReactNode;
}

export const ScrollWrapper = ({
    children,
    minContentHeight = 200,
    maxContentHeight,
    minContentWidth = 200,
    insertActionGroup,
}: ScrollWrapperProps): ReactNode => (
    <GtkScrolledWindow
        minContentHeight={minContentHeight}
        maxContentHeight={maxContentHeight}
        minContentWidth={minContentWidth}
        insertActionGroup={insertActionGroup}
    >
        {children}
    </GtkScrolledWindow>
);
