import type * as Gtk from "@gtkx/gi/gtk";
import { error, pickBy, warn } from "@gtkx/utils";
import process from "node:process";
import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useRef, useState } from "react";
import {
    applicationId as defaultApplicationId,
    resourceBasePath as defaultResourceBasePath,
} from "virtual:gtkx-config";
import { ApplicationContext } from "../hooks/use-application.js";
import { useMergedRef } from "../hooks/use-merged-refs.js";
import { reconciler } from "../reconciler/host-config.js";
import { createPortaledComponent } from "./portaled.js";

type ApplicationComponentProps = {
    applicationId?: string | null | undefined;
    children?: ReactNode | undefined;
    ref?: Ref<Gtk.Application | null> | undefined;
    resourceBasePath?: string | null | undefined;
};

type ApplicationFailure = { error: unknown };

type ApplicationLifecycle = {
    application: Gtk.Application;
    activated: boolean;
    generation: number;
    hasCommitted: boolean;
    isMounted: boolean;
    settled: boolean;
    releaseStartup: (() => void) | null;
};

const POST_ACTIVATE_PROPS = new Set(["menubar"]);

const holdForStartup = (lifecycle: ApplicationLifecycle): void => {
    if (lifecycle.hasCommitted || lifecycle.releaseStartup) {
        return;
    }

    lifecycle.application.hold();
    lifecycle.releaseStartup = (): void => {
        lifecycle.releaseStartup = null;
        lifecycle.application.release();
    };
};

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
    lifecycle: ApplicationLifecycle,
    applicationId: string | null,
    onComplete: () => void,
    onFailure: (cause: unknown) => void,
): void => {
    const { application } = lifecycle;
    const completion = application.runAsync(commandLine(applicationId));
    const generation = lifecycle.generation;
    void completion.then((exitStatus) => {
        if (lifecycle.generation === generation) {
            onComplete();
        }

        if (exitStatus !== 0) {
            process.exitCode = exitStatus;
        }
    }, (cause) => {
        if (lifecycle.generation === generation) {
            onFailure(cause);
        } else {
            process.exitCode = 1;
            error("Application shutdown failed:", cause);
        }
    });
    reportOwnedApplicationId(application);
};

const useApplicationLifecycle = (
    application: Gtk.Application | null,
    activated: boolean,
    setActivated: (isActivated: boolean) => void,
    setFailure: (failure: ApplicationFailure) => void,
    applicationId: string | null,
): void => {
    const currentLifecycle = useRef<ApplicationLifecycle | null>(null);

    useLayoutEffect(() => {
        if (!application) {
            return;
        }

        const previous = currentLifecycle.current;
        const lifecycle = previous?.application === application && !previous.settled
            ? previous
            : {
                application,
                activated: false,
                generation: 0,
                hasCommitted: false,
                isMounted: true,
                settled: false,
                releaseStartup: null,
            };
        currentLifecycle.current = lifecycle;
        lifecycle.isMounted = true;

        const onActivate = (): void => {
            if (lifecycle.settled) {
                lifecycle.generation += 1;
                lifecycle.settled = false;
            }

            holdForStartup(lifecycle);
            lifecycle.activated = true;
            setActivated(true);
        };
        const onShutdown = (): void => {
            lifecycle.activated = false;
            lifecycle.hasCommitted = false;
            lifecycle.settled = true;
            lifecycle.releaseStartup?.();
            reconciler.flushSyncFromReconciler(() => setActivated(false));
        };
        application.on("activate", onActivate);
        application.on("shutdown", onShutdown);

        if (lifecycle === previous) {
            if (lifecycle.activated) {
                holdForStartup(lifecycle);
            }

            setActivated(lifecycle.activated);
        } else {
            const onComplete = (): void => {
                lifecycle.settled = true;
                lifecycle.activated = false;
                lifecycle.releaseStartup?.();

                if (lifecycle.isMounted) {
                    setActivated(false);
                } else {
                    application.quit();
                }
            };

            startApplication(lifecycle, applicationId, onComplete, (cause) => {
                onComplete();

                if (lifecycle.isMounted) {
                    setFailure({ error: cause });
                } else {
                    process.exitCode = 1;
                    error("Application shutdown failed:", cause);
                }
            });
        }

        return () => {
            lifecycle.isMounted = false;
            application.off("activate", onActivate);
            application.off("shutdown", onShutdown);
            lifecycle.releaseStartup?.();

            if (lifecycle.settled) {
                application.quit();
            }

            setActivated(false);
        };
    }, [application, setActivated, setFailure, applicationId]);

    useLayoutEffect(() => {
        const lifecycle = currentLifecycle.current;

        if (activated && lifecycle?.application === application) {
            lifecycle.hasCommitted = true;
            lifecycle.releaseStartup?.();
        }
    }, [activated, application]);
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
        useApplicationLifecycle(application, activated, setActivated, setFailure, applicationId);
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
