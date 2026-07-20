import { applicationId as defaultApplicationId } from "virtual:gtkx-config";
import type * as Gtk from "@gtkx/gi/gtk";
import { quitApplication, runApplication } from "@gtkx/runtime";
import { type ElementType, type ReactNode, type Ref, useCallback, useState } from "react";
import { ApplicationContext } from "../hooks/use-application.js";
import { useMergedRef } from "../hooks/use-merged-refs.js";

const POST_ACTIVATE_PROPS = new Set(["menubar"]);

type ApplicationComponentProps = {
    applicationId?: string | null | undefined;
    children?: ReactNode | undefined;
    ref?: Ref<Gtk.Application | null> | undefined;
};

export const createApplicationComponent = (
    Component: ElementType,
): ((props: ApplicationComponentProps) => ReactNode) => {
    return ({ applicationId = defaultApplicationId, children, ref, ...rest }: ApplicationComponentProps): ReactNode => {
        const [app, setApp] = useState<Gtk.Application | null>(null);

        const handleMount = useCallback((instance: Gtk.Application) => {
            runApplication(instance);
            setApp(instance);

            return () => {
                quitApplication(instance);
                setApp(null);
            };
        }, []);

        const mergedRef = useMergedRef<Gtk.Application>(ref, handleMount);

        const appliedProps = app
            ? rest
            : Object.fromEntries(Object.entries(rest).filter(([key]) => !POST_ACTIVATE_PROPS.has(key)));

        return (
            <Component ref={mergedRef} applicationId={applicationId} {...appliedProps}>
                {app ? <ApplicationContext.Provider value={app}>{children}</ApplicationContext.Provider> : null}
            </Component>
        );
    };
};
