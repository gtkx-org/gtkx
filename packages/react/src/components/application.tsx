import type * as Gtk from "@gtkx/gi/gtk";
import { error, pickBy, warn } from "@gtkx/utils";
import process from "node:process";
import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useState } from "react";
import {
    applicationId as defaultApplicationId,
    resourceBasePath as defaultResourceBasePath,
} from "virtual:gtkx-config";
import { ApplicationContext } from "../hooks/use-application.js";
import { useMergedRef } from "../hooks/use-merged-refs.js";
import { createPortaledComponent } from "./portaled.js";

type ApplicationComponentProps = {
    applicationId?: string | null | undefined;
    children?: ReactNode | undefined;
    ref?: Ref<Gtk.Application | null> | undefined;
    resourceBasePath?: string | null | undefined;
};

type ApplicationFailure = { error: unknown };

const POST_ACTIVATE_PROPS = new Set(["menubar"]);

const commandLine = (applicationId: string | null): string[] => [
    applicationId?.split(".").at(-1) ?? "gtkx",
    ...process.argv.slice(2),
];

const reportOwnedApplicationId = (application: Gtk.Application): void => {
    if (!application.getIsRegistered() || !application.getIsRemote()) {
        return;
    }

    warn(
        `Another process already owns ${application.applicationId ?? "this application ID"}, so this process ` +
        "registered as a remote instance and can never show a window. Quit that instance or change " +
        "applicationId, then start this application again.",
    );
};

const startApplication = (
    application: Gtk.Application,
    applicationId: string | null,
    onFailure: (cause: unknown) => void,
): void => {
    void application.runAsync(commandLine(applicationId)).then((exitStatus) => {
        if (exitStatus !== 0) {
            process.exitCode = exitStatus;
        }
    }, onFailure);
    reportOwnedApplicationId(application);
};

const useApplicationLifecycle = (
    application: Gtk.Application | null,
    setActivated: (isActivated: boolean) => void,
    setFailure: (failure: ApplicationFailure) => void,
    applicationId: string | null,
): void => {
    useLayoutEffect(() => {
        if (!application) {
            return;
        }

        let isMounted = true;
        const onActivate = (): void => {
            setActivated(true);
        };
        application.on("activate", onActivate);
        startApplication(application, applicationId, (cause) => {
            if (isMounted) {
                setFailure({ error: cause });
            } else {
                process.exitCode = 1;
                error("Application shutdown failed:", cause);
            }
        });

        return () => {
            isMounted = false;
            application.off("activate", onActivate);
            application.quit();
            setActivated(false);
        };
    }, [application, setActivated, setFailure, applicationId]);
};

const applicationChildren = (application: Gtk.Application | null, children: ReactNode): ReactNode => {
    if (!application) {
        return null;
    }

    return <ApplicationContext.Provider value={application}>{children}</ApplicationContext.Provider>;
};

const createApplicationElement = (
    Component: ElementType,
): ((props: ApplicationComponentProps) => ReactNode) => {
    return ({
        applicationId = defaultApplicationId,
        children,
        ref,
        resourceBasePath = defaultResourceBasePath,
        ...rest
    }: ApplicationComponentProps): ReactNode => {
        const [application, setApplication] = useState<Gtk.Application | null>(null);
        const [activated, setActivated] = useState(false);
        const [failure, setFailure] = useState<ApplicationFailure | null>(null);
        useApplicationLifecycle(application, setActivated, setFailure, applicationId);
        const mergedRef = useMergedRef(ref, setApplication);
        const appliedProps = activated ? rest : pickBy(rest, (_value, key) => !POST_ACTIVATE_PROPS.has(key));

        if (failure) {
            throw failure.error;
        }

        return (
            <Component
                ref={mergedRef}
                applicationId={applicationId}
                {...appliedProps}
                resourceBasePath={resourceBasePath}
            >
                {activated ? applicationChildren(application, children) : null}
            </Component>
        );
    };
};

const createApplicationComponent = (Component: ElementType): ((props: unknown) => ReactNode) =>
    createPortaledComponent(createApplicationElement(Component));

/** @internal */
export { createApplicationComponent };
