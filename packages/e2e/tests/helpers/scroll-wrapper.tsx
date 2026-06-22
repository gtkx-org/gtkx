import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";

export interface ScrollWrapperProps {
    children: ReactNode;
    minContentHeight?: number | undefined;
    maxContentHeight?: number | undefined;
    minContentWidth?: number | undefined;
    actionGroups?: ReactNode;
}

export const ScrollWrapper = ({
    children,
    minContentHeight = 200,
    maxContentHeight,
    minContentWidth = 200,
    actionGroups,
}: ScrollWrapperProps): ReactNode => (
    <GtkScrolledWindow
        minContentHeight={minContentHeight}
        maxContentHeight={maxContentHeight}
        minContentWidth={minContentWidth}
        actionGroups={actionGroups}
    >
        {children}
    </GtkScrolledWindow>
);
