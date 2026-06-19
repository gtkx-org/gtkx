import * as Gio from "@gtkx/gi/gio";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import type { ActionAccel } from "@gtkx/react";
import { type ReactNode, useState } from "react";

export interface AppShellProps {
    title?: string;
    width?: number;
    height?: number;
    headerStart?: ReactNode;
    headerEnd?: ReactNode;
    actions?: ReactNode;
    actionAccels?: ActionAccel[];
    children: ReactNode;
}

let nextAppId = 0;

export const AppShell = ({
    title = "Notes",
    width = 600,
    height = 500,
    headerStart,
    headerEnd,
    actions,
    actionAccels,
    children,
}: AppShellProps) => {
    const [applicationId] = useState(() => `org.gtkx.appshell${nextAppId++}`);
    return (
        <AdwApplication
            applicationId={applicationId}
            flags={Gio.ApplicationFlags.NON_UNIQUE}
            actionAccels={actionAccels}
        >
            <AdwApplicationWindow title={title} defaultWidth={width} defaultHeight={height} addAction={actions}>
                <AdwToolbarView
                    addTopBar={
                        <AdwHeaderBar
                            packStart={headerStart ? headerStart : null}
                            packEnd={headerEnd ? headerEnd : null}
                        />
                    }
                >
                    {children}
                </AdwToolbarView>
            </AdwApplicationWindow>
        </AdwApplication>
    );
};
