import { applicationId as defaultApplicationId } from "virtual:gtkx-config";
import { quitApplication, runApplication } from "@gtkx/ffi";
import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useCallback, useLayoutEffect, useState } from "react";
import { ApplicationContext, useApplication } from "../hooks/use-application.js";
import { useMergeRefs } from "../hooks/use-merge-refs.js";
import { withWindowPresentation } from "./top-level.js";

type ApplicationOf<P> = P extends { ref?: Ref<infer T | null> }
    ? T extends Gtk.Application
        ? T
        : Gtk.Application
    : Gtk.Application;

const useApplicationInstance = <T extends Gtk.Application>(
    ref: Ref<T | null> | undefined,
): [Gtk.Application | null, (instance: T | null) => void] => {
    const [app, setApp] = useState<Gtk.Application | null>(null);
    const [registeredApp, setRegisteredApp] = useState<Gtk.Application | null>(null);

    const captureInstance = useCallback((instance: T | null) => {
        setApp(instance);
        if (!instance) setRegisteredApp(null);
    }, []);
    const captureApp = useMergeRefs<T>(ref, captureInstance);

    useLayoutEffect(() => {
        if (!app) return;
        runApplication(app);
        setRegisteredApp(app);
        return () => {
            quitApplication(app);
        };
    }, [app]);

    return [registeredApp, captureApp] as const;
};

const ApplicationChildren = ({ app, children }: { app: Gtk.Application | null; children: ReactNode }): ReactNode =>
    app && <ApplicationContext.Provider value={app}>{children}</ApplicationContext.Provider>;

type ApplicationComponentProps<T extends Gtk.Application> = {
    applicationId?: string | null;
    children?: ReactNode;
    menubar?: Gio.MenuModel | ReactNode;
    ref?: Ref<T | null>;
};

export const withApplicationLifecycle = <P extends ApplicationComponentProps<ApplicationOf<P>>>(
    Element: ElementType,
): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { applicationId = defaultApplicationId, children, menubar, ref, ...rest } = props;
        const [app, captureApp] = useApplicationInstance<ApplicationOf<P>>(ref);
        const menubarProps = app ? { menubar } : {};
        return (
            <Element ref={captureApp} {...rest} applicationId={applicationId} {...menubarProps}>
                <ApplicationChildren app={app}>{children}</ApplicationChildren>
            </Element>
        );
    };
};

export const withApplicationWindowPresentation = <P extends { children?: ReactNode; ref?: Ref<Gtk.Window | null> }>(
    Underlying: ElementType,
): ((props: P) => ReactNode) => {
    type SurfaceProps = Omit<P, "children"> & {
        application: ReturnType<typeof useApplication>;
        children?: ReactNode;
    };
    const Surface = withWindowPresentation<SurfaceProps>(Underlying);
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
