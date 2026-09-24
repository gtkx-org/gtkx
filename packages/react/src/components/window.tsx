import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, use } from "react";
import { ApplicationContext } from "../hooks/use-application.js";
import { ParentWindowContext } from "../hooks/use-parent-window.js";
import { createPresentedComponent, type PresentedProps } from "../hooks/use-presented-instance.js";
import { applyMutation } from "../reconciler/signals.js";
import { createPortaledComponent } from "./portaled.js";

type WindowComponentProps = PresentedProps<Gtk.Window> & {
    application?: Gtk.Application | null | undefined;
    // eslint-disable-next-line gtkx/accessor-naming
    transientFor?: Gtk.Window | null | undefined;
};

const presentWindow = (window: Gtk.Window): void => {
    applyMutation(() => {
        window.present();
    });
};

const destroyWindow = (window: Gtk.Window): void => {
    applyMutation(() => {
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

const withWindowDefaults = (Component: ElementType): ((props: WindowComponentProps) => ReactNode) => {
    return (props: WindowComponentProps): ReactNode => {
        const application = use(ApplicationContext);
        const parent = use(ParentWindowContext);
        const hasDefaultApplication = props.application === undefined && application !== null;
        const hasDefaultParent = props.transientFor === undefined && parent !== null;

        return (
            <Component
                {...props}
                {...(hasDefaultApplication ? { application } : {})}
                {...(hasDefaultParent ? { transientFor: parent } : {})}
            />
        );
    };
};

const createWindowComponent = (Component: ElementType): ((props: unknown) => ReactNode) =>
    createPortaledComponent(withWindowDefaults(createPresentedWindowComponent(Component)));

export { createPresentedWindowComponent };
/** @internal */
export { createWindowComponent };
