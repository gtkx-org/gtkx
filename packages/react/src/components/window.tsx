import * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, use } from "react";
import { ApplicationContext } from "../hooks/use-application.js";
import { useDismissalWatch } from "../hooks/use-dismissal.js";
import { ParentWindowContext } from "../hooks/use-parent-window.js";
import { createPresentedComponent, type PresentedProps } from "../hooks/use-presented-instance.js";
import type { Props } from "../reconciler/registry.js";
import { applyMutation } from "../reconciler/signals.js";
import { describeElement, typeNameOf } from "../utils/dismissal.js";
import { createPortaledComponent } from "./portaled.js";

type WindowComponentProps = PresentedProps<Gtk.Window> & {
    application?: Gtk.Application | null | undefined;
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

const toplevelWindows = (): Gtk.Window[] => {
    const toplevels = Gtk.Window.getToplevels();
    const windows: Gtk.Window[] = [];

    for (let position = 0; position < toplevels.getNItems(); position += 1) {
        const window = toplevels.getItem(position);

        if (window instanceof Gtk.Window) {
            windows.push(window);
        }
    }

    return windows;
};

const staleWindowMessage = (window: Gtk.Window, props: Props): string | null => {
    const toplevels = toplevelWindows();

    if (toplevels.includes(window)) {
        return !window.getVisible() && props.visible === true
            ? `${describeElement(window, props)} was hidden by a close request while the app still passes ` +
                  "visible={true}. Set visible to false from onCloseRequest, or stop rendering the window there."
            : null;
    }

    return toplevels.some((other) => other.getVisible())
        ? `${describeElement(window, props)} was closed while the app still renders it, so it cannot be shown ` +
              "again. Handle onCloseRequest and stop rendering it there; return true to keep it open."
        : null;
};

const useWindowCloseRequests = (window: Gtk.Window | null, props: Props): Props => {
    useDismissalWatch(window, "unmap", window === null ? "" : `${typeNameOf(window)}:closed`, () =>
        window === null ? null : staleWindowMessage(window, props),
    );

    return props;
};

const createPresentedWindowComponent = (Component: ElementType): ((props: PresentedProps<Gtk.Window>) => ReactNode) =>
    createPresentedComponent<Gtk.Window>(Component, {
        usePresent: usePresentWindow,
        dismiss: destroyWindow,
        useNativeProps: useWindowCloseRequests,
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
