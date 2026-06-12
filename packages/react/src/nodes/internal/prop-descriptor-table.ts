/// <reference types="@gtkx/config/virtual" />

/**
 * Per-GType signal/imperative prop descriptors for real-GObject instances.
 *
 * A handful of widget props are neither plain GObject properties nor array
 * props: applying them is an imperative GTK call (`setVisibleChildName`), a
 * refined signal connection, an object-valued prop driving multi-argument
 * calls, or a virtual prop forwarded to a setter. All are serializable rows —
 * {@link "@gtkx/config".PropRule}, {@link "@gtkx/config".ObjectPropRow}, and
 * {@link "@gtkx/config".VirtualPropRow} — delivered by `virtual:gtkx-config`
 * and interpreted here. {@link getPropDescriptors} merges the matching
 * entries (walking the instance's GType ancestry) into the table the
 * renderer's `apply-props` consumes, sparing each widget a bespoke node
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
import type { GType } from "@gtkx/gi/gobject";
import { runCallSteps } from "../../array-props.js";
import { collectTypeNameChain } from "../../gtype.js";
import type { Instance } from "../../instance.js";
import { imperative, type PropDescriptorTable, signal } from "./apply-props.js";
import { callMethod } from "./reflect-call.js";

const satisfiesCondition = (value: unknown, condition: PropCondition | undefined): boolean => {
    if (condition === undefined) return true;
    if (condition === "defined") return value !== undefined;
    if (condition === "nonNull") return value != null;
    return Boolean(value);
};

const applySetterStep = (instance: Instance, step: SetterPropStep): void => {
    const target = instance.backingInstance;
    if (!target) return;
    const value = instance.props[step.prop];
    if (!satisfiesCondition(value, step.when)) return;
    if (step.skipWhenGetterEquals !== undefined && callMethod(target, step.skipWhenGetterEquals, []) === value) {
        return;
    }
    if (
        step.requireGetterTruthyWithValue !== undefined &&
        !callMethod(target, step.requireGetterTruthyWithValue, [value])
    ) {
        return;
    }
    if (step.call !== undefined) callMethod(target, step.call, [value]);
    else if (step.set !== undefined) Reflect.set(target, step.set, value);
};

const addSetterGroup = (table: PropDescriptorTable, instance: Instance, group: SetterPropGroup): void => {
    if (group.always) {
        const applyAll = (): void => {
            for (const step of group.props) applySetterStep(instance, step);
        };
        for (const step of group.props) table[step.prop] = imperative(applyAll, { always: true });
        return;
    }
    for (const step of group.props) {
        table[step.prop] = imperative(() => applySetterStep(instance, step));
    }
};

const addRuleRows = (table: PropDescriptorTable, instance: Instance, rules: readonly PropRule[]): void => {
    for (const rule of rules) {
        if (rule.kind === "setters") {
            addSetterGroup(table, instance, rule);
            continue;
        }
        table[rule.prop] = signal(rule.signal, {
            getArgs: rule.noArgs ? () => [] : undefined,
            returnValue: rule.returnValue,
        });
    }
};

const objectPropDescriptor = (instance: Instance, prop: string, row: ObjectPropRow): PropDescriptorTable[string] =>
    imperative(() => {
        const target = instance.backingInstance;
        if (!target) return;
        const value = instance.props[prop];
        if (value == null) {
            if (row.unset !== undefined) runCallSteps(target, row.unset, null);
            return;
        }
        runCallSteps(target, row.set, value);
    });

const virtualPropDescriptor = (instance: Instance, prop: string, row: VirtualPropRow): PropDescriptorTable[string] =>
    imperative(() => {
        const target = instance.backingInstance;
        if (!target) return;
        callMethod(target, row.setter, [instance.props[prop] ?? null]);
        if (row.after !== undefined) callMethod(target, row.after, []);
    });

type TableBuilder = (instance: Instance, table: PropDescriptorTable) => void;

const buildTypeNameBuilders = (): Record<string, readonly TableBuilder[]> => {
    const builders: Record<string, TableBuilder[]> = {};
    const push = (typeName: string, builder: TableBuilder): void => {
        const typeBuilders = builders[typeName] ?? [];
        builders[typeName] = typeBuilders;
        typeBuilders.push(builder);
    };
    for (const [typeName, rules] of Object.entries(PROP_RULES)) {
        push(typeName, (instance, table) => {
            addRuleRows(table, instance, rules);
        });
    }
    for (const [typeName, props] of Object.entries(OBJECT_PROPS)) {
        push(typeName, (instance, table) => {
            for (const [prop, row] of Object.entries(props)) table[prop] = objectPropDescriptor(instance, prop, row);
        });
    }
    for (const [typeName, props] of Object.entries(VIRTUAL_PROPS)) {
        push(typeName, (instance, table) => {
            for (const [prop, row] of Object.entries(props)) table[prop] = virtualPropDescriptor(instance, prop, row);
        });
    }
    return builders;
};

/**
 * Maps a GLib type name to the table builders that type contributes to any
 * instance whose GType ancestry includes it.
 */
const BUILDERS_BY_TYPE_NAME: Readonly<Record<string, readonly TableBuilder[]>> = buildTypeNameBuilders();

const buildersByGType = new Map<GType, readonly TableBuilder[]>();

/**
 * Resolves the table builders a GType's full ancestry contributes, ordered
 * least-derived first so a more derived type's rows overwrite an ancestor's
 * when both name the same prop. Cached per GType.
 */
const getBuilders = (gtype: GType): readonly TableBuilder[] => {
    const cached = buildersByGType.get(gtype);
    if (cached) return cached;
    const builders: TableBuilder[] = [];
    for (const typeName of collectTypeNameChain(gtype).toReversed()) {
        const typeBuilders = BUILDERS_BY_TYPE_NAME[typeName];
        if (typeBuilders) builders.push(...typeBuilders);
    }
    buildersByGType.set(gtype, builders);
    return builders;
};

const tableCache = new WeakMap<Instance, PropDescriptorTable>();

/**
 * Returns the signal/imperative prop descriptors for `instance`, merged across
 * its backing GObject's GType ancestry (most-derived entries win). Cached per
 * instance, since each descriptor closes over the instance; the builder list
 * itself is cached per GType.
 *
 * @param instance - The reconciler instance whose descriptors to resolve.
 */
export const getPropDescriptors = (instance: Instance): PropDescriptorTable => {
    const cached = tableCache.get(instance);
    if (cached) return cached;
    const table: PropDescriptorTable = {};
    const backing = instance.backingInstance;
    if (backing) {
        for (const builder of getBuilders(backing.__gtype__)) builder(instance, table);
    }
    tableCache.set(instance, table);
    return table;
};
