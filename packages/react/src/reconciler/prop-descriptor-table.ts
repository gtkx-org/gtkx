/// <reference types="@gtkx/config/virtual" />

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
import type {
    ObjectPropRow,
    PropCondition,
    PropRule,
    SetterPropGroup,
    SetterPropStep,
    VirtualPropRow,
} from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";
import { collectTypeNameChain } from "../utils/gtype.js";
import { imperative, type PropDescriptorTable, signal } from "./apply-props.js";
import { ARRAY_PROPS, runCallSteps } from "./array-props.js";
import { callMethod } from "./reflect-call.js";
import type { Props } from "./types.js";

const satisfiesCondition = (value: unknown, condition: PropCondition | undefined): boolean => {
    if (condition === undefined) return true;
    if (condition === "defined") return value !== undefined;
    if (condition === "nonNull") return value != null;
    return Boolean(value);
};

const applySetterStep = (container: GObject.Object, step: SetterPropStep, newProps: Props): void => {
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
    if (step.call !== undefined) callMethod(container, step.call, [value]);
    else if (step.set !== undefined) Reflect.set(container, step.set, value);
};

const addSetterGroup = (entry: PropDescriptorTable, group: SetterPropGroup): void => {
    if (group.always) {
        const descriptor = imperative(
            (container, newProps) => {
                for (const step of group.props) applySetterStep(container, step, newProps);
            },
            { always: true },
        );
        for (const step of group.props) entry[step.prop] = descriptor;
        return;
    }
    for (const step of group.props) {
        entry[step.prop] = imperative((container, newProps) => applySetterStep(container, step, newProps));
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
    const merged: PropDescriptorTable = {};
    for (const typeName of collectTypeNameChain(gtype).toReversed()) {
        const entry = DESCRIPTORS_BY_TYPE_NAME[typeName];
        if (entry) Object.assign(merged, entry);
    }
    descriptorsByGtype.set(gtype, merged);
    return merged;
};
