import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import {
    cloneElement,
    type ElementType,
    isValidElement,
    type ReactNode,
    type Ref,
    useCallback,
    useEffect,
    useLayoutEffect,
    useState,
} from "react";
import type { MenuProps } from "../jsx.js";
import { ApplicationContext, useApplication } from "../render.js";
import { assignRef } from "../use-merged-refs.js";
import { withTopLevel } from "./top-level.js";

/**
 * The concrete application instance type a props shape captures through its
 * `ref`, defaulting to `Gtk.Application` when the props expose no application
 * ref. Lets {@link createApplication} forward the caller's ref without widening
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
 * and registers and activates it once it exists.
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

    const captureApp = useCallback(
        (instance: T | null) => {
            setApp(instance);
            if (!instance) setRegisteredApp(null);
            assignRef(ref, instance);
        },
        [ref],
    );

    useLayoutEffect(() => {
        if (!app) return;
        const activateHandlerId = app.connect("activate", () => {});
        if (!app.getIsRegistered()) app.register(null);
        app.activate();
        setRegisteredApp(app);
        return () => app.disconnect(activateHandlerId);
    }, [app]);

    return [registeredApp, captureApp] as const;
};

/**
 * Installs the menu produced by the `menubar` slot on the application's menubar
 * once the application has registered, clearing it on unmount.
 *
 * `gtk_application_set_menubar` asserts the application is registered, which
 * happens in a layout effect; this passive effect runs strictly afterwards, so
 * the menubar is set on a registered application.
 *
 * @param app - The registered application, or `null` before mount.
 * @param menu - The built `Gio.Menu`, or `null` when no menubar was provided.
 */
const useApplicationMenubar = (app: Gtk.Application | null, menu: Gio.Menu | null): void => {
    useEffect(() => {
        if (!app?.getIsRegistered()) return;
        app.setMenubar(menu);
        return () => {
            if (app.getIsRegistered()) app.setMenubar(null);
        };
    }, [app, menu]);
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
 * The minimum prop shape {@link createApplication} requires: a child tree, an
 * optional `<Menu>` for the menubar slot, and an optional caller ref to the
 * backing application.
 *
 * @typeParam T - The concrete application type captured through `ref`.
 */
type ApplicationComponentProps<T extends Gtk.Application> = {
    /** The application's window tree. */
    children?: ReactNode;
    /** A `<Menu>` whose built `Gio.Menu` is installed as the application menubar. */
    menubar?: ReactNode;
    /** Caller ref forwarded to the backing application. */
    ref?: Ref<T | null>;
};

/**
 * Builds an application component for an application host element. The component
 * constructs the backing application from `applicationId`/`flags`, registers and
 * activates it, provides it to descendants through {@link ApplicationContext},
 * and installs a `<Menu>` passed to `menubar` once the application has
 * registered.
 *
 * @typeParam P - The component prop shape; its `ref` determines the captured
 *   application type and its `menubar` accepts a `<Menu>` element.
 * @param Element - The application host intrinsic to construct.
 * @returns A component that drives the application's lifecycle.
 */
export const createApplication = <P extends ApplicationComponentProps<ApplicationOf<P>>>(
    Element: ElementType,
): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { children, menubar, ref, ...rest } = props;
        const [app, captureApp] = useApplicationInstance<ApplicationOf<P>>(ref);
        const [menu, setMenu] = useState<Gio.Menu | null>(null);
        useApplicationMenubar(app, menu);
        return (
            <Element ref={captureApp} {...rest}>
                <ApplicationChildren app={app}>
                    {renderMenubar(menubar, setMenu)}
                    {children}
                </ApplicationChildren>
            </Element>
        );
    };
};

/**
 * Builds an application-window component for a top-level surface host element.
 *
 * The component reads the enclosing application from {@link useApplication} and
 * passes it as the window's construct-only `application` property, then drives
 * the surface lifecycle through {@link withTopLevel}: it presents the window on
 * mount and destroys it on unmount.
 *
 * @typeParam P - The application-window prop shape.
 * @param Underlying - The window host intrinsic or slotted compound to render.
 * @returns A component that injects the application and drives the window's
 *   lifecycle.
 */
export const withApplicationWindow = <P extends { children?: ReactNode; ref?: Ref<Gtk.Window | null> }>(
    Underlying: ElementType,
): ((props: P) => ReactNode) => {
    const Surface = withTopLevel<P>(Underlying);
    return (props: P): ReactNode => {
        const application = useApplication();
        return <Surface application={application} {...props} />;
    };
};

const renderMenubar = (menubar: ReactNode, setMenu: (menu: Gio.Menu | null) => void): ReactNode => {
    if (!isValidElement<MenuProps & { ref?: Ref<Gio.Menu | null> }>(menubar)) return null;
    return cloneElement(menubar, { ref: setMenu });
};
