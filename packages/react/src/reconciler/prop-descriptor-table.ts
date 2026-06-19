/// <reference types="@gtkx/config/virtual" />

/**
 * Per-GType signal/imperative prop descriptors for real-GObject nodes.
 *
 * A handful of widget props are neither plain GObject properties nor array
 * props: applying them is an imperative GTK call (`setVisibleChildName`), a
 * refined signal connection, an object-valued prop driving multi-argument
 * calls, or a virtual prop forwarded to a setter. All are serializable rows —
 * {@link "@gtkx/config".PropRule}, {@link "@gtkx/config".ObjectPropRow}, and
 * {@link "@gtkx/config".VirtualPropRow} — delivered by `virtual:gtkx-config`
 * and interpreted here. {@link getPropDescriptors} merges the matching
 * entries (walking the node's GType ancestry) into the table the renderer's
 * `apply-props` consumes, sparing each widget a bespoke node subclass.
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
import * as GObject from "@gtkx/gi/gobject";
import { collectTypeNameChain } from "../utils/gtype.js";
import { imperative, type PropDescriptorTable, signal } from "./apply-props.js";
import { runCallSteps } from "./array-props.js";
import { callMethod } from "./reflect-call.js";
import type { Node } from "./state.js";
import type { Props } from "./types.js";

const satisfiesCondition = (value: unknown, condition: PropCondition | undefined): boolean => {
    if (condition === undefined) return true;
    if (condition === "defined") return value !== undefined;
    if (condition === "nonNull") return value != null;
    return Boolean(value);
};

const applySetterStep = (node: Node, step: SetterPropStep, newProps: Props): void => {
    if (!(node instanceof GObject.Object)) return;
    const target = node;
    const value = newProps[step.prop];
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

const addSetterGroup = (table: PropDescriptorTable, node: Node, group: SetterPropGroup): void => {
    if (group.always) {
        const descriptor = imperative(
            (_oldProps, newProps) => {
                for (const step of group.props) applySetterStep(node, step, newProps);
            },
            { always: true },
        );
        for (const step of group.props) table[step.prop] = descriptor;
        return;
    }
    for (const step of group.props) {
        table[step.prop] = imperative((_oldProps, newProps) => applySetterStep(node, step, newProps));
    }
};

const addRuleRows = (table: PropDescriptorTable, node: Node, rules: readonly PropRule[]): void => {
    for (const rule of rules) {
        if (rule.kind === "setters") {
            addSetterGroup(table, node, rule);
            continue;
        }
        table[rule.prop] = signal(rule.signal, {
            getArgs: rule.noArgs ? () => [] : undefined,
            returnValue: rule.returnValue,
        });
    }
};

const objectPropDescriptor = (node: Node, prop: string, row: ObjectPropRow): PropDescriptorTable[string] =>
    imperative((_oldProps, newProps) => {
        if (!(node instanceof GObject.Object)) return;
        const value = newProps[prop];
        if (value == null) {
            if (row.unset !== undefined) runCallSteps(node, row.unset, null);
            return;
        }
        runCallSteps(node, row.set, value);
    });

const virtualPropDescriptor = (node: Node, prop: string, row: VirtualPropRow): PropDescriptorTable[string] =>
    imperative((_oldProps, newProps) => {
        if (!(node instanceof GObject.Object)) return;
        callMethod(node, row.setter, [newProps[prop] ?? null]);
        if (row.after !== undefined) callMethod(node, row.after, []);
    });

type TableBuilder = (node: Node, table: PropDescriptorTable) => void;

const buildTypeNameBuilders = (): Record<string, readonly TableBuilder[]> => {
    const builders: Record<string, TableBuilder[]> = {};
    const push = (typeName: string, builder: TableBuilder): void => {
        const typeBuilders = builders[typeName] ?? [];
        builders[typeName] = typeBuilders;
        typeBuilders.push(builder);
    };
    for (const [typeName, rules] of Object.entries(PROP_RULES)) {
        push(typeName, (node, table) => {
            addRuleRows(table, node, rules);
        });
    }
    for (const [typeName, props] of Object.entries(OBJECT_PROPS)) {
        push(typeName, (node, table) => {
            for (const [prop, row] of Object.entries(props)) table[prop] = objectPropDescriptor(node, prop, row);
        });
    }
    for (const [typeName, props] of Object.entries(VIRTUAL_PROPS)) {
        push(typeName, (node, table) => {
            for (const [prop, row] of Object.entries(props)) table[prop] = virtualPropDescriptor(node, prop, row);
        });
    }
    return builders;
};

/**
 * Maps a GLib type name to the table builders that type contributes to any
 * node whose GType ancestry includes it.
 */
const BUILDERS_BY_TYPE_NAME: Readonly<Record<string, readonly TableBuilder[]>> = buildTypeNameBuilders();

const buildersByGtype = new Map<GObject.GType, readonly TableBuilder[]>();

/**
 * Resolves the table builders a GType's full ancestry contributes, ordered
 * least-derived first so a more derived type's rows overwrite an ancestor's
 * when both name the same prop. Cached per GType.
 */
const getBuilders = (gtype: GObject.GType): readonly TableBuilder[] => {
    const cached = buildersByGtype.get(gtype);
    if (cached) return cached;
    const builders: TableBuilder[] = [];
    for (const typeName of collectTypeNameChain(gtype).toReversed()) {
        const typeBuilders = BUILDERS_BY_TYPE_NAME[typeName];
        if (typeBuilders) builders.push(...typeBuilders);
    }
    buildersByGtype.set(gtype, builders);
    return builders;
};

const tableCache = new WeakMap<Node, PropDescriptorTable>();

/**
 * Returns the signal/imperative prop descriptors for `node`, merged across its
 * backing GObject's GType ancestry (most-derived entries win). Cached per node,
 * since each descriptor closes over the node; the builder list itself is cached
 * per GType.
 *
 * @param node - The reconciler node whose descriptors to resolve.
 */
export const getPropDescriptors = (node: Node): PropDescriptorTable => {
    const cached = tableCache.get(node);
    if (cached) return cached;
    const table: PropDescriptorTable = {};
    if (node instanceof GObject.Object) {
        for (const builder of getBuilders(node.__gtype__)) builder(node, table);
    }
    tableCache.set(node, table);
    return table;
};
