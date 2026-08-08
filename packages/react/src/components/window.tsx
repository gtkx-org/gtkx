import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactElement, type ReactNode, use } from "react";
import { ParentWindowContext } from "../hooks/use-parent-window.js";
import { createPresentedComponent, type PresentedProps } from "../hooks/use-presented-instance.js";
import { applyWrite } from "../reconciler/signals.js";
import { createPortaledComponent } from "./portaled.js";

type WindowComponentProps = PresentedProps<Gtk.Window> & {
    // eslint-disable-next-line gtkx/accessor-naming
    transientFor?: Gtk.Window | ReactElement | null | undefined;
};

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

const createPresentedWindowComponent = (Component: ElementType): ((props: PresentedProps<Gtk.Window>) => ReactNode) =>
    createPresentedComponent<Gtk.Window>(Component, {
        usePresent: usePresentWindow,
        dismiss: destroyWindow,
        wrap: (element, window) => (
            <ParentWindowContext.Provider value={window}>{element}</ParentWindowContext.Provider>
        ),
    });

const withDefaultTransientFor = (Component: ElementType): ((props: WindowComponentProps) => ReactNode) => {
    return (props: WindowComponentProps): ReactNode => {
        const parent = use(ParentWindowContext);
        const isDefaulted = props.transientFor === undefined && parent !== null;

        return <Component {...(isDefaulted ? { ...props, transientFor: parent } : props)} />;
    };
};

const createWindowComponent = (Component: ElementType): ((props: unknown) => ReactNode) =>
    createPortaledComponent(withDefaultTransientFor(createPresentedWindowComponent(Component)));

export { createPresentedWindowComponent };
/** @internal */
export { createWindowComponent };
