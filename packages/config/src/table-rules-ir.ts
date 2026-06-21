/**
 * Internal codegen-emitted rule intermediate representation.
 *
 * These types describe the reconciler rule tables that `@gtkx/codegen` emits as
 * trusted constants and the React reconciler consumes. They are never authored
 * by app users in `gtkx.config.ts` and therefore carry no runtime validators.
 */

/**
 * Presence test a setter step is gated on before it runs.
 */
export type PropCondition = "defined" | "nonNull" | "truthy";

/**
 * A single prop driven by an instance setter or method call, with optional
 * gating against the wrapper's current state.
 */
export type SetterPropStep = {
    prop: string;
    call?: string;
    set?: string;
    when?: PropCondition;
    skipWhenGetterEquals?: string;
    requireGetterTruthyWithValue?: string;
    skipWhenGetterDivergedFromCommitted?: string;
};

/**
 * A group of setter-driven props applied together for an element.
 */
export type SetterPropGroup = {
    kind: "setters";
    props: SetterPropStep[];
    always?: boolean;
};

/**
 * A prop bound to a GObject signal rather than a setter.
 */
export type SignalPropRule = {
    kind: "signal";
    prop: string;
    signal: string;
    noArgs?: boolean;
    returnValue?: unknown;
};

/**
 * A reconciler rule for a single prop: either a setter group or a signal binding.
 */
export type PropRule = SetterPropGroup | SignalPropRule;

/**
 * An argument a generated add-method draws from a child node.
 */
export type AddMethodArg = "widget" | "id" | "title" | "iconName";

/**
 * A method used to attach a child, with the arguments it consumes and requires.
 */
export type AddMethodRule = {
    method: string;
    args: AddMethodArg[];
    requires: AddMethodArg[];
};

/**
 * A setter that writes page metadata onto a notebook/stack-style child.
 */
export type PageMetaSetter = {
    setter: string;
    prop: string;
    fallback?: unknown;
    whenPresent?: boolean;
};
