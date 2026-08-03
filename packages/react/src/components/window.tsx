import type * as Gtk from "@gtkx/gi/gtk";
import type { ElementType, ReactNode } from "react";
import { ParentWindowContext } from "../hooks/use-parent-window.js";
import { createPresentedComponent, type PresentedProps } from "../hooks/use-presented-instance.js";
import { applyWrite } from "../reconciler/signals.js";

type WindowComponentProps = PresentedProps<Gtk.Window>;

const presentWindow = (window: Gtk.Window): void => {
    applyWrite(() => {
        window.present();
    });
};

const destroyWindow = (window: Gtk.Window): void => {
    applyWrite(() => {
        window.destroy();
    });
};

const usePresentWindow = (): ((window: Gtk.Window) => void) => presentWindow;

const createWindowComponent = (Component: ElementType): ((props: WindowComponentProps) => ReactNode) =>
    createPresentedComponent<Gtk.Window>(Component, {
        usePresent: usePresentWindow,
        dismiss: destroyWindow,
        wrap: (element, window) => (
            <ParentWindowContext.Provider value={window}>{element}</ParentWindowContext.Provider>
        ),
    });

/** @internal */
export { createWindowComponent };
