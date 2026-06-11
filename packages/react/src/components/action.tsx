import { createElement, type ElementType, type ReactNode, useContext, useEffect, useMemo } from "react";
import { ApplicationContext } from "../render.js";
import { type ActionScope, ActionScopeContext } from "./internal/action-scope-context.js";

const toAccels = (accels: unknown): string[] => {
    if (typeof accels === "string") return [accels];
    if (Array.isArray(accels)) return accels.filter((accel): accel is string => typeof accel === "string");
    return [];
};

/** The prop shape {@link withActionAccels} reads from its host element. */
type ActionAccelsProps = {
    /** The action's name within its scope. */
    name?: string | null;
    /** Keyboard accelerator(s) bound on the enclosing application. */
    accels?: string | string[];
};

/**
 * Builds an action component that binds its `accels` prop on the enclosing
 * application under the enclosing action scope's detailed name
 * (`"<prefix>.<name>"`), rebinding when the accelerators, the name, or the
 * scope change and clearing the binding on unmount. Every other prop forwards
 * to the host element. Without an application or scope in context the
 * accelerators are inert, matching an action map GTK cannot route to.
 *
 * @typeParam P - The action component prop shape.
 * @param Element - The action host intrinsic to render.
 * @returns A component that manages the action's accelerators.
 */
export const withActionAccels = <P extends ActionAccelsProps>(Element: ElementType): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { accels, ...rest } = props;
        const application = useContext(ApplicationContext);
        const scope = useContext(ActionScopeContext);
        const name = typeof props.name === "string" ? props.name : null;
        const accelKey = toAccels(accels).join("\n");

        useEffect(() => {
            if (!application || !scope || name === null || accelKey.length === 0) return;
            const detailedName = `${scope.prefix}.${name}`;
            application.setAccelsForAction(detailedName, accelKey.split("\n"));
            return () => application.setAccelsForAction(detailedName, []);
        }, [application, scope, name, accelKey]);

        return createElement(Element, rest);
    };
};

/** The prop shape {@link withActionScope} reads from its host element. */
type ActionScopeProps = {
    /** The action-name prefix the group installs under on its host widget. */
    prefix?: string;
    /** The group's `<GSimpleAction>` children. */
    children?: ReactNode;
};

/**
 * Builds an action-group component that provides its `prefix` as the action
 * scope for `<GSimpleAction>` children, so their `accels` bind under the
 * group's detailed action names. The `prefix` prop also stays on the host
 * element, where the element map's `insertActionGroup` verb reads it.
 *
 * @typeParam P - The action-group component prop shape.
 * @param Element - The action-group host intrinsic to render.
 * @returns A component that scopes its children's accelerators.
 */
export const withActionScope = <P extends ActionScopeProps>(Element: ElementType): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { children, ...rest } = props;
        const prefix = typeof props.prefix === "string" ? props.prefix : null;
        const scope = useMemo<ActionScope | null>(() => (prefix === null ? null : { prefix }), [prefix]);
        return createElement(
            Element,
            rest,
            <ActionScopeContext.Provider value={scope}>{children}</ActionScopeContext.Provider>,
        );
    };
};
