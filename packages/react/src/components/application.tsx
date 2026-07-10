import { applicationId as defaultApplicationId } from "virtual:gtkx-config";
import { quitApplication, runApplication } from "@gtkx/ffi";
import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useCallback, useLayoutEffect, useState } from "react";
import { ApplicationContext } from "../hooks/use-application.js";
import { useMergeRefs } from "../hooks/use-merge-refs.js";

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
    applicationId?: string | null | undefined;
    children?: ReactNode | undefined;
    menubar?: Gio.MenuModel | ReactNode | undefined;
    ref?: Ref<T | null> | undefined;
};

export const createApplicationComponent = <P extends ApplicationComponentProps<ApplicationOf<P>>>(
    Component: ElementType,
): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { applicationId = defaultApplicationId, children, menubar, ref, ...rest } = props;
        const [app, captureApp] = useApplicationInstance<ApplicationOf<P>>(ref);
        const menubarProps = app ? { menubar } : {};
        return (
            <Component ref={captureApp} {...rest} applicationId={applicationId} {...menubarProps}>
                <ApplicationChildren app={app}>{children}</ApplicationChildren>
            </Component>
        );
    };
};
