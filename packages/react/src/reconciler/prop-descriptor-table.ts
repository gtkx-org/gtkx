/// <reference types="@gtkx/config/env" />

/**
 * The unified per-GType prop-descriptor view for real-GObject nodes.
 *
 * A handful of widget props are neither plain GObject properties nor handled by
 * a single property set: applying one reconciles an array into repeated GTK
 * calls, connects a refined GObject signal, drives multi-argument calls from an
 * object value, or forwards a value to a setter. All are serializable rows —
 * {@link "@gtkx/config".ArrayPropRow}, {@link "@gtkx/config".PropRule},
 * {@link "@gtkx/config".ObjectPropRow}, and {@link "@gtkx/config".VirtualPropRow}
 * — delivered by `virtual:gtkx-config` and compiled here into one
 * {@link PropDescriptorTable} per GLib type. {@link getDescriptors} merges the
 * entries matching a node's GType ancestry (most-derived winning) into the view
 * the renderer's `apply-props` consumes, sparing each widget a bespoke node
 * subclass.
 */
import { OBJECT_PROPS, PROP_RULES, VIRTUAL_PROPS } from "virtual:gtkx-config";
import type { ObjectPropRow, PropRule, SetterPropGroup, SetterPropStep, VirtualPropRow } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";
import { foldInheritedTableWithInterfaces } from "../utils/gtype.js";
import { ARRAY_PROPS, type ArrayPropDescriptor } from "./array-props.js";
import { runCallSteps, satisfiesCondition } from "./call-steps.js";
import { callMethod } from "./reflect-call.js";
import type { Props } from "./types.js";

/**
 * Descriptor for a prop whose value is a callback bound to GObject signals.
 *
 * @see {@link signal}
 */
export interface SignalPropDescriptor {
    readonly kind: "signal";
    readonly signals: readonly string[];
    readonly blockable?: boolean;
    readonly getArgs?: () => readonly unknown[] | null;
    readonly returnValue?: unknown;
}

/**
 * A bespoke prop's side-effecting handler; receives the backing GObject, the
 * current props, and the previously-committed props (`null` on first mount).
 * Taking the container as an argument keeps the handler stateless so its
 * descriptor is shared per GType rather than rebuilt per node.
 */
export type ImperativeHandler = (container: GObject.Object, newProps: Props, oldProps: Props | null) => void;

/**
 * Descriptor for a prop applied by running a side-effecting handler.
 *
 * @see {@link imperative}
 */
export interface ImperativeDescriptor {
    readonly kind: "imperative";
    readonly handler: ImperativeHandler;
    readonly always: boolean;
}

/** A descriptor for one bespoke prop: array reconciliation, signal wiring, or an imperative handler. */
export type PropDescriptor = SignalPropDescriptor | ImperativeDescriptor | ArrayPropDescriptor;

/** A node's bespoke props, keyed by prop name; the unified per-GType descriptor view. */
export type PropDescriptorTable = Record<string, PropDescriptor>;

/**
 * Builds a {@link SignalPropDescriptor}.
 *
 * @param signals - GObject signal name, or names, the callback connects to
 * @param options - `blockable` overrides whether the handler is suppressed
 *   during commits (default `true`); `getArgs` computes the arguments the
 *   callback receives, returning `null` to skip the call (default: the raw
 *   signal arguments); `returnValue` is the value the GObject handler returns
 */
export function signal(
    signals: string | readonly string[],
    options?: Omit<SignalPropDescriptor, "kind" | "signals">,
): SignalPropDescriptor {
    return {
        kind: "signal",
        signals: typeof signals === "string" ? [signals] : signals,
        ...options,
    };
}

/**
 * Builds an {@link ImperativeDescriptor}.
 *
 * Several prop keys may share one handler reference; the shared handler then
 * runs once per commit when any of those props change. With `always`, the
 * handler runs on every commit regardless of whether its props changed.
 *
 * @param handler - side-effecting handler applied to the widget
 * @param options - `always` forces the handler to run on every commit
 */
export function imperative(handler: ImperativeHandler, options?: { always?: boolean }): ImperativeDescriptor {
    return { kind: "imperative", handler, always: options?.always ?? false };
}

const applySetterStep = (
    container: GObject.Object,
    step: SetterPropStep,
    newProps: Props,
    oldProps: Props | null,
): void => {
    const value = newProps[step.prop];
    if (!satisfiesCondition(value, step.when)) return;
    if (step.skipWhenGetterEquals !== undefined && callMethod(container, step.skipWhenGetterEquals, []) === value) {
        return;
    }
    if (
        step.requireGetterTruthyWithValue !== undefined &&
        !callMethod(container, step.requireGetterTruthyWithValue, [value])
    ) {
        return;
    }
    if (step.skipWhenGetterDivergedFromCommitted !== undefined) {
        const committed = oldProps?.[step.prop];
        if (
            committed !== undefined &&
            callMethod(container, step.skipWhenGetterDivergedFromCommitted, []) !== committed
        ) {
            return;
        }
    }
    if (step.call !== undefined) callMethod(container, step.call, [value]);
    else if (step.set !== undefined) Reflect.set(container, step.set, value);
};

const addSetterGroup = (entry: PropDescriptorTable, group: SetterPropGroup): void => {
    if (group.always) {
        const descriptor = imperative(
            (container, newProps, oldProps) => {
                for (const step of group.props) applySetterStep(container, step, newProps, oldProps);
            },
            { always: true },
        );
        for (const step of group.props) entry[step.prop] = descriptor;
        return;
    }
    for (const step of group.props) {
        entry[step.prop] = imperative((container, newProps, oldProps) =>
            applySetterStep(container, step, newProps, oldProps),
        );
    }
};

const addRuleRows = (entry: PropDescriptorTable, rules: readonly PropRule[]): void => {
    for (const rule of rules) {
        if (rule.kind === "setters") {
            addSetterGroup(entry, rule);
            continue;
        }
        entry[rule.prop] = signal(rule.signal, {
            getArgs: rule.noArgs ? () => [] : undefined,
            returnValue: rule.returnValue,
        });
    }
};

const objectPropDescriptor = (prop: string, row: ObjectPropRow): PropDescriptorTable[string] =>
    imperative((container, newProps) => {
        const value = newProps[prop];
        if (value == null) {
            if (row.unset !== undefined) runCallSteps(container, row.unset, null);
            return;
        }
        runCallSteps(container, row.set, value);
    });

const virtualPropDescriptor = (prop: string, row: VirtualPropRow): PropDescriptorTable[string] =>
    imperative((container, newProps) => {
        callMethod(container, row.setter, [newProps[prop] ?? null]);
        if (row.after !== undefined) callMethod(container, row.after, []);
    });

/**
 * Compiles the per-GLib-type-name descriptor entries once at module load,
 * folding every serializable source — array rows, prop rules, object props, and
 * virtual props — into one table per type name.
 */
const buildDescriptorsByTypeName = (): Record<string, PropDescriptorTable> => {
    const byType: Record<string, PropDescriptorTable> = {};
    const entryFor = (typeName: string): PropDescriptorTable => (byType[typeName] ??= {});
    for (const [typeName, props] of Object.entries(ARRAY_PROPS)) {
        const entry = entryFor(typeName);
        for (const [prop, descriptor] of Object.entries(props)) entry[prop] = descriptor;
    }
    for (const [typeName, rules] of Object.entries(PROP_RULES)) addRuleRows(entryFor(typeName), rules);
    for (const [typeName, props] of Object.entries(OBJECT_PROPS)) {
        const entry = entryFor(typeName);
        for (const [prop, row] of Object.entries(props)) entry[prop] = objectPropDescriptor(prop, row);
    }
    for (const [typeName, props] of Object.entries(VIRTUAL_PROPS)) {
        const entry = entryFor(typeName);
        for (const [prop, row] of Object.entries(props)) entry[prop] = virtualPropDescriptor(prop, row);
    }
    return byType;
};

/** Per-GLib-type-name descriptor entries, compiled once from every serializable source. */
const DESCRIPTORS_BY_TYPE_NAME: Readonly<Record<string, PropDescriptorTable>> = buildDescriptorsByTypeName();

const descriptorsByGtype = new Map<GObject.GType, PropDescriptorTable>();

/**
 * Returns the unified prop-descriptor view for `instance`, merged across its
 * backing GObject's GType ancestry (most-derived entries win). Cached per GType:
 * every descriptor takes the container as an argument, so one view serves every
 * instance of a type.
 *
 * @param instance - The backing GObject whose descriptors to resolve.
 */
export const getDescriptors = (instance: GObject.Object): PropDescriptorTable => {
    const gtype = instance.__gtype__;
    const cached = descriptorsByGtype.get(gtype);
    if (cached) return cached;
    const merged = foldInheritedTableWithInterfaces(
        gtype,
        DESCRIPTORS_BY_TYPE_NAME,
        (view: PropDescriptorTable, entry) => {
            for (const [prop, descriptor] of Object.entries(entry)) view[prop] ??= descriptor;
            return view;
        },
        {},
    );
    descriptorsByGtype.set(gtype, merged);
    return merged;
};
