import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { quitApplication, runApplication } from "@gtkx/runtime";
import { pickBy } from "@gtkx/utils";
import process from "node:process";
import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useState } from "react";
import { applicationId as defaultApplicationId } from "virtual:gtkx-config";
import { ApplicationContext } from "../hooks/use-application.js";
import { useMergedRef } from "../hooks/use-merged-refs.js";

type ApplicationComponentProps = {
    applicationId?: string | null | undefined;
    children?: ReactNode | undefined;
    ref?: Ref<Gtk.Application | null> | undefined;
};

const POST_ACTIVATE_PROPS = new Set(["menubar"]);
const SERVICE_MODE_ARGUMENT = "--gapplication-service";

const isServiceLaunch = (): boolean => process.argv.includes(SERVICE_MODE_ARGUMENT);

const enterServiceMode = (application: Gtk.Application, setActivated: (isActivated: boolean) => void): void => {
    application.setFlags(application.getFlags() | Gio.ApplicationFlags.IS_SERVICE);

    application.on("activate", () => {
        setActivated(true);
    });
};

const startApplication = (
    application: Gtk.Application,
    setActivated: (isActivated: boolean) => void,
): void => {
    const isService = isServiceLaunch();

    if (isService) {
        enterServiceMode(application, setActivated);
        runApplication(application, { isService });

        return;
    }

    setActivated(runApplication(application, { isService }).isPrimary);
};

const useApplicationLifecycle = (
    application: Gtk.Application | null,
    setActivated: (isActivated: boolean) => void,
): void => {
    useLayoutEffect(() => {
        if (!application) {
            return;
        }

        startApplication(application, setActivated);

        return () => {
            quitApplication(application);
            setActivated(false);
        };
    }, [application, setActivated]);
};

const applicationChildren = (application: Gtk.Application | null, children: ReactNode): ReactNode => {
    if (!application) {
        return null;
    }

    return <ApplicationContext.Provider value={application}>{children}</ApplicationContext.Provider>;
};

const createApplicationComponent = (
    Component: ElementType,
): ((props: ApplicationComponentProps) => ReactNode) => {
    return ({ applicationId = defaultApplicationId, children, ref, ...rest }: ApplicationComponentProps): ReactNode => {
        const [application, setApplication] = useState<Gtk.Application | null>(null);
        const [activated, setActivated] = useState(false);
        useApplicationLifecycle(application, setActivated);
        const mergedRef = useMergedRef(ref, setApplication);
        const appliedProps = activated ? rest : pickBy(rest, (_value, key) => !POST_ACTIVATE_PROPS.has(key));

        return (
            <Component ref={mergedRef} applicationId={applicationId} {...appliedProps}>
                {activated ? applicationChildren(application, children) : null}
            </Component>
        );
    };
};

/** @internal */
export { createApplicationComponent };
