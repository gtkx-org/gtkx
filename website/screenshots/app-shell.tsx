import { AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/react";
import type { ReactNode } from "react";
import { noop } from "./data";

export interface AppShellProps {
    title?: string;
    width?: number;
    height?: number;
    headerStart?: ReactNode;
    headerEnd?: ReactNode;
    children: ReactNode;
}

export const AppShell = ({
    title = "Notes",
    width = 600,
    height = 500,
    headerStart,
    headerEnd,
    children,
}: AppShellProps) => (
    <AdwApplicationWindow title={title} defaultWidth={width} defaultHeight={height} onClose={noop}>
        <AdwToolbarView
            addTopBar={
                <AdwHeaderBar packStart={headerStart ? headerStart : null} packEnd={headerEnd ? headerEnd : null} />
            }
        >
            {children}
        </AdwToolbarView>
    </AdwApplicationWindow>
);
