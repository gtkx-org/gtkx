import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkWindow } from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";
import { type ComponentType, useState } from "react";
import type { Demo as DemoDefinition, DemoProviderProps } from "../demos/types.js";
import { parseTitle, useDemo } from "../context/demo-context.js";

type DemoWindowProps = {
    onClose: () => void;
};

type DemoWindowSizing = {
    defaultWidth: number;
    defaultHeight: number;
    isResizable: boolean;
    isDeletable: boolean;
};

const PassthroughProvider: ComponentType<DemoProviderProps> = ({ children }) => children;

function demoWindowTitle(demo: DemoDefinition, windowTitle: string | null): string {
    const { displayTitle } = parseTitle(demo.title);

    return windowTitle ?? demo.windowTitle ?? displayTitle;
}

function demoWindowSizing(demo: DemoDefinition): DemoWindowSizing {
    return {
        defaultWidth: demo.defaultWidth ?? -1,
        defaultHeight: demo.defaultHeight ?? -1,
        isResizable: demo.isResizable ?? true,
        isDeletable: demo.isDeletable ?? true,
    };
}

const DemoWindow = ({ onClose }: DemoWindowProps) => {
    const { currentDemo, windowTitle, defaultWidget } = useDemo();
    const hostWindow = useParentWindow();
    const [window, setWindow] = useState<Gtk.Window | null>(null);

    if (!currentDemo?.component) {
        return null;
    }

    const DemoComponent = currentDemo.component;
    const DemoTitlebar = currentDemo.titlebar;
    const DemoStateProvider = currentDemo.provider ?? PassthroughProvider;

    if (currentDemo.isDialogOnly) {
        if (!hostWindow) {
            return null;
        }

        return (
            <DemoStateProvider window={hostWindow} onClose={onClose}>
                <DemoComponent onClose={onClose} window={hostWindow} />
            </DemoStateProvider>
        );
    }

    const titlebar = DemoTitlebar ? <DemoTitlebar onClose={onClose} window={window} /> : undefined;
    const sizing = demoWindowSizing(currentDemo);

    return (
        <DemoStateProvider window={window} onClose={onClose}>
            <GtkWindow
                ref={setWindow}
                name="demo-window"
                title={demoWindowTitle(currentDemo, windowTitle)}
                defaultWidth={sizing.defaultWidth}
                defaultHeight={sizing.defaultHeight}
                resizable={sizing.isResizable}
                deletable={sizing.isDeletable}
                cssClasses={currentDemo.windowCssClasses}
                defaultWidget={defaultWidget}
                titlebar={titlebar}
                onCloseRequest={() => {
                    onClose();

                    return Gdk.EVENT_STOP;
                }}
            >
                <DemoComponent onClose={onClose} window={window} />
            </GtkWindow>
        </DemoStateProvider>
    );
};

export { DemoWindow };
