import type * as Gtk from "@gtkx/gi/gtk";
import { quitApplication, runApplication } from "@gtkx/runtime";
import { pickBy, warn } from "@gtkx/utils";
import process from "node:process";
import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useState } from "react";
import { applicationId as defaultApplicationId } from "virtual:gtkx-config";
import { ApplicationContext } from "../hooks/use-application.js";
import { useMergedRef } from "../hooks/use-merged-refs.js";
import { createPortaledComponent } from "./portaled.js";

type ApplicationComponentProps = {
    applicationId?: string | null | undefined;
    children?: ReactNode | undefined;
    ref?: Ref<Gtk.Application | null> | undefined;
};

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
    setActivated: (isActivated: boolean) => void,
    applicationId: string | null,
): void => {
    application.on("activate", () => {
        setActivated(true);
    });

    const { exitStatus } = runApplication(application, commandLine(applicationId));
    reportOwnedApplicationId(application);

    if (exitStatus !== 0) {
        process.exitCode = exitStatus;
    }
};

const useApplicationLifecycle = (
    application: Gtk.Application | null,
    setActivated: (isActivated: boolean) => void,
    applicationId: string | null,
): void => {
    useLayoutEffect(() => {
        if (!application) {
            return;
        }

        startApplication(application, setActivated, applicationId);

        return () => {
            quitApplication(application);
            setActivated(false);
        };
    }, [application, setActivated, applicationId]);
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
    return ({ applicationId = defaultApplicationId, children, ref, ...rest }: ApplicationComponentProps): ReactNode => {
        const [application, setApplication] = useState<Gtk.Application | null>(null);
        const [activated, setActivated] = useState(false);
        useApplicationLifecycle(application, setActivated, applicationId);
        const mergedRef = useMergedRef(ref, setApplication);
        const appliedProps = activated ? rest : pickBy(rest, (_value, key) => !POST_ACTIVATE_PROPS.has(key));

        return (
            <Component ref={mergedRef} applicationId={applicationId} {...appliedProps}>
                {activated ? applicationChildren(application, children) : null}
            </Component>
        );
    };
};

const createApplicationComponent = (Component: ElementType): ((props: unknown) => ReactNode) =>
    createPortaledComponent(createApplicationElement(Component));

/** @internal */
export { createApplicationComponent };
