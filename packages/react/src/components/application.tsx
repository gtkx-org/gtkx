import type * as Gtk from "@gtkx/gi/gtk";
import { quitApplication, runApplication } from "@gtkx/runtime";
import { pickBy } from "@gtkx/utils";
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

const useApplicationLifecycle = (
    application: Gtk.Application | null,
    setActivated: (isActivated: boolean) => void,
): void => {
    useLayoutEffect(() => {
        if (!application) {
            return;
        }

        runApplication(application);
        setActivated(true);

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

export { createApplicationComponent };
