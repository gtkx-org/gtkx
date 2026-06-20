import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useCallback, useLayoutEffect, useState } from "react";
import { ApplicationContext, useApplication } from "../hooks/use-application.js";
import { useForwardedRef } from "../hooks/use-forwarded-ref.js";
import { quitApplicationLifecycle, runApplicationLifecycle } from "../utils/application-lifecycle.js";
import { withTopLevel } from "./top-level.js";

/**
 * The concrete application instance type a props shape captures through its
 * `ref`, defaulting to `Gtk.Application` when the props expose no application
 * ref. Lets {@link withApplication} forward the caller's ref without widening
 * an `Adw.Application` ref to `Gtk.Application`.
 *
 * @typeParam P - The application component prop shape.
 */
type ApplicationOf<P> = P extends { ref?: Ref<infer T | null> }
    ? T extends Gtk.Application
        ? T
        : Gtk.Application
    : Gtk.Application;

/**
 * Captures an application instance through a callback ref, exposes it as state,
 * registers and activates it once it exists, starts driving its run loop, and
 * quits it when the component unmounts, stopping the GTK runtime by default.
 *
 * @typeParam T - The concrete application type (`Gtk.Application` or a subtype).
 * @param ref - Optional caller ref to forward the application to.
 * @returns The captured application (or `null` before mount) and the ref to
 *   bind to the application host element.
 */
const useApplicationInstance = <T extends Gtk.Application>(
    ref: Ref<T | null> | undefined,
): readonly [Gtk.Application | null, (instance: T | null) => void] => {
    const [app, setApp] = useState<Gtk.Application | null>(null);
    const [registeredApp, setRegisteredApp] = useState<Gtk.Application | null>(null);

    const captureInstance = useCallback((instance: T | null) => {
        setApp(instance);
        if (!instance) setRegisteredApp(null);
    }, []);
    const [, captureApp] = useForwardedRef<T>(ref, captureInstance);

    useLayoutEffect(() => {
        if (!app) return;
        runApplicationLifecycle(app);
        setRegisteredApp(app);
        return () => {
            quitApplicationLifecycle(app);
        };
    }, [app]);

    return [registeredApp, captureApp] as const;
};

/**
 * Wraps children in the application context once the application is available,
 * so descendants observe a non-null context from {@link useApplication}.
 *
 * @param app - The activated application, or `null` before mount.
 * @param children - The application's child tree.
 */
const ApplicationChildren = ({ app, children }: { app: Gtk.Application | null; children: ReactNode }): ReactNode =>
    app && <ApplicationContext.Provider value={app}>{children}</ApplicationContext.Provider>;

/**
 * The minimum prop shape {@link withApplication} requires: a child tree, an
 * optional menubar slot, and an optional caller ref to the backing application.
 *
 * @typeParam T - The concrete application type captured through `ref`.
 */
type ApplicationComponentProps<T extends Gtk.Application> = {
    /** The application's window tree. */
    children?: ReactNode;
    /** A `<GMenu>` element or `Gio.MenuModel` installed as the application menubar once registered. */
    menubar?: Gio.MenuModel | ReactNode;
    /** Caller ref forwarded to the backing application. */
    ref?: Ref<T | null>;
};

/**
 * Builds an application component for an application host element. The component
 * constructs the backing application from `applicationId`/`flags`, registers and
 * activates it, and provides it to descendants through {@link ApplicationContext}.
 *
 * The `menubar` is forwarded as an ordinary slot prop, but only once the
 * application has registered: `gtk_application_set_menubar` asserts a registered
 * application and registration completes in a layout effect, so the slot is
 * withheld until the captured application is non-null.
 *
 * @typeParam P - The component prop shape; its `ref` determines the captured
 *   application type.
 * @param Element - The application host intrinsic to construct.
 * @returns A component that drives the application's lifecycle.
 */
export const withApplication = <P extends ApplicationComponentProps<ApplicationOf<P>>>(
    Element: ElementType,
): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { children, menubar, ref, ...rest } = props;
        const [app, captureApp] = useApplicationInstance<ApplicationOf<P>>(ref);
        const menubarProps = app ? { menubar } : {};
        return (
            <Element ref={captureApp} {...rest} {...menubarProps}>
                <ApplicationChildren app={app}>{children}</ApplicationChildren>
            </Element>
        );
    };
};

/**
 * Builds an application-window component for a top-level surface host element.
 *
 * The component reads the enclosing application from {@link useApplication} and
 * passes it as the window's `application` property, then drives the surface
 * lifecycle through {@link withTopLevel}: it presents the window on mount and
 * destroys it on unmount. `<GSimpleAction>` elements passed to the window's
 * `addAction` prop install on the window's action map under `win.<name>`.
 *
 * @typeParam P - The application-window prop shape.
 * @param Underlying - The window host intrinsic or slotted compound to render.
 * @returns A component that injects the application and drives the window's
 *   lifecycle.
 */
export const withApplicationWindow = <P extends { children?: ReactNode; ref?: Ref<Gtk.Window | null> }>(
    Underlying: ElementType,
): ((props: P) => ReactNode) => {
    type SurfaceProps = Omit<P, "children"> & {
        application: ReturnType<typeof useApplication>;
        children?: ReactNode;
    };
    const Surface = withTopLevel<SurfaceProps>(Underlying);
    return (props: P): ReactNode => {
        const application = useApplication();
        const { children, ...rest } = props;
        return (
            <Surface application={application} {...rest}>
                {children}
            </Surface>
        );
    };
};
