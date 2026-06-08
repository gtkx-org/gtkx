import type * as Adw from "@gtkx/gi/adw";
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
import type { AdwApplicationProps, GtkApplicationProps, MenuProps } from "../jsx.js";
import { ApplicationContext } from "../render.js";
import { assignRef } from "../use-merged-refs.js";

const GtkApplicationElement = "GtkApplication" as const;
const AdwApplicationElement = "AdwApplication" as const;

/**
 * Props for the {@link GtkApplication} component: the generated application props
 * with the `menubar` property re-typed to accept a `<Menu>` element.
 */
type GtkApplicationComponentProps = Omit<GtkApplicationProps, "menubar"> & {
    /** A `<Menu>` whose built `Gio.Menu` is installed as the application menubar. */
    menubar?: ReactNode;
};

/**
 * Props for the {@link AdwApplication} component: the generated application props
 * with the `menubar` property re-typed to accept a `<Menu>` element.
 */
type AdwApplicationComponentProps = Omit<AdwApplicationProps, "menubar"> & {
    /** A `<Menu>` whose built `Gio.Menu` is installed as the application menubar. */
    menubar?: ReactNode;
    /** Caller ref forwarded to the backing `Adw.Application`. */
    ref?: Ref<Adw.Application | null>;
};

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

    const captureApp = useCallback(
        (instance: T | null) => {
            setApp(instance);
            assignRef(ref, instance);
        },
        [ref],
    );

    useLayoutEffect(() => {
        if (!app) return;
        app.register(null);
        app.activate();
    }, [app]);

    return [app, captureApp] as const;
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
 * Builds an application component for an application host element. The component
 * constructs the backing application from `applicationId`/`flags`, registers and
 * activates it, provides it to descendants through {@link ApplicationContext},
 * and installs a `<Menu>` passed to `menubar` once the application has
 * registered.
 *
 * @typeParam T - The concrete application type (`Gtk.Application` or a subtype).
 * @typeParam P - The component prop shape (`Gtk`/`Adw` application props plus a
 *   `<Menu>`-typed `menubar`).
 * @param Element - The application host intrinsic to construct.
 */
const createApplication = <
    T extends Gtk.Application,
    P extends { children?: ReactNode; menubar?: ReactNode; ref?: Ref<T | null> },
>(
    Element: ElementType,
): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { children, menubar, ref, ...rest } = props;
        const [app, captureApp] = useApplicationInstance(ref);
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
 * Declarative wrapper for `Gtk.Application`.
 *
 * Constructs the backing `Gtk.Application` from `applicationId`/`flags`,
 * registers and activates it, and provides it to descendants through
 * {@link ApplicationContext}. Pass a `<Menu>` to `menubar` to install an
 * application menubar; render the application's windows as children.
 *
 * @example
 * ```tsx
 * <GtkApplication applicationId="com.example.myapp">
 *   <GtkApplicationWindow title="My App">…</GtkApplicationWindow>
 * </GtkApplication>
 * ```
 */
export const GtkApplication = createApplication<Gtk.Application, GtkApplicationComponentProps>(GtkApplicationElement);

/**
 * Declarative wrapper for `Adw.Application`.
 *
 * Constructs the backing `Adw.Application` from `applicationId`/`flags`,
 * registers and activates it, and provides it to descendants through
 * {@link ApplicationContext}. Pass a `<Menu>` to `menubar` to install an
 * application menubar; render the application's windows as children.
 *
 * @example
 * ```tsx
 * <AdwApplication applicationId="com.example.myapp">
 *   <AdwApplicationWindow>…</AdwApplicationWindow>
 * </AdwApplication>
 * ```
 */
export const AdwApplication = createApplication<Adw.Application, AdwApplicationComponentProps>(AdwApplicationElement);

const renderMenubar = (menubar: ReactNode, setMenu: (menu: Gio.Menu | null) => void): ReactNode => {
    if (!isValidElement<MenuProps & { ref?: Ref<Gio.Menu | null> }>(menubar)) return null;
    return cloneElement(menubar, { ref: setMenu });
};
