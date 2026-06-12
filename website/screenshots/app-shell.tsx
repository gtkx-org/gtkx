import { AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import type { ReactNode } from "react";

export interface AppShellProps {
    title?: string;
    width?: number;
    height?: number;
    headerStart?: ReactNode;
    headerEnd?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}

export const AppShell = ({
    title = "Notes",
    width = 600,
    height = 500,
    headerStart,
    headerEnd,
    actions,
    children,
}: AppShellProps) => (
    <AdwApplicationWindow title={title} defaultWidth={width} defaultHeight={height} addAction={actions}>
        <AdwToolbarView
            addTopBar={
                <AdwHeaderBar packStart={headerStart ? headerStart : null} packEnd={headerEnd ? headerEnd : null} />
            }
        >
            {children}
        </AdwToolbarView>
    </AdwApplicationWindow>
);
