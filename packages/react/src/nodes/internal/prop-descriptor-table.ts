/// <reference types="@gtkx/config/virtual" />

/**
 * Per-GType signal/imperative prop descriptors for real-GObject instances.
 *
 * A handful of widget props are neither plain GObject properties nor array
 * props: applying them is an imperative GTK call (`setVisibleChildName`) or a
 * refined signal connection. Almost all are serializable
 * {@link "@gtkx/config".PropRule} rows delivered by `virtual:gtkx-config` and
 * interpreted here; the text-buffer controller hookup for
 * `GtkTextView`/`GtkSourceView` is the designated hand-written exception (the
 * offset model stays code). {@link getPropDescriptors} merges the matching
 * entries (walking the instance's GType ancestry) into the table the
 * renderer's `apply-props` consumes, sparing each widget a bespoke node
 * subclass.
 */
import { PROP_RULES } from "virtual:gtkx-config";
import type { PropCondition, PropRule, SetterPropGroup, SetterPropStep } from "@gtkx/config";
import * as Gtk from "@gtkx/gi/gtk";
import type { GtkTextViewProps } from "@gtkx/jsx/gtk";
import type { GtkSourceViewProps } from "@gtkx/jsx/gtksource";
import { collectTypeNameChain } from "../../gtype.js";
import type { Instance } from "../../instance.js";
import { type ImperativeHandler, imperative, type PropDescriptorTable, signal } from "./apply-props.js";
import { callMethod } from "./reflect-call.js";
import { getTextBufferController } from "./text-buffer-registry.js";

/** Builds the descriptor set a single GType contributes to an instance. */
type DescriptorFactory = (instance: Instance) => PropDescriptorTable;

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

const buildRuleTable = (instance: Instance, rules: readonly PropRule[]): PropDescriptorTable => {
    const table: PropDescriptorTable = {};
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
    return table;
};

const TEXT_VIEW_BUFFER_PROPS: readonly (keyof GtkTextViewProps)[] = [
    "buffer",
    "enableUndo",
    "onBufferChanged",
    "onTextInserted",
    "onTextDeleted",
    "onCanUndoChanged",
    "onCanRedoChanged",
];

const SOURCE_VIEW_BUFFER_PROPS: readonly (keyof GtkSourceViewProps)[] = [
    "language",
    "styleScheme",
    "highlightSyntax",
    "highlightMatchingBrackets",
    "implicitTrailingNewline",
    "onCursorMoved",
    "onHighlightUpdated",
];

const fillTable = (props: readonly string[], handler: ImperativeHandler): PropDescriptorTable => {
    const table: PropDescriptorTable = {};
    for (const prop of props) table[prop] = imperative(handler, { always: true });
    return table;
};

const textViewDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    const view = instance.backingInstance;
    if (!(view instanceof Gtk.TextView)) return {};
    const controller = getTextBufferController(instance, view);
    const apply: ImperativeHandler = (oldProps) => controller.applyProps(oldProps, instance.props);
    return fillTable(TEXT_VIEW_BUFFER_PROPS, apply);
};

const sourceViewDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    const view = instance.backingInstance;
    if (!(view instanceof Gtk.TextView)) return {};
    const controller = getTextBufferController(instance, view);
    const applySource: ImperativeHandler = (oldProps) => controller.applySourceProps(oldProps, instance.props);
    return fillTable(SOURCE_VIEW_BUFFER_PROPS, applySource);
};

const buildDataFactories = (): Record<string, DescriptorFactory> => {
    const factories: Record<string, DescriptorFactory> = {};
    for (const [typeName, rules] of Object.entries(PROP_RULES)) {
        factories[typeName] = (instance) => buildRuleTable(instance, rules);
    }
    return factories;
};

/**
 * Maps a GLib type name to the prop descriptors merged for any instance whose
 * GType ancestry includes that type.
 */
const PROP_DESCRIPTOR_TABLE: Readonly<Record<string, DescriptorFactory>> = {
    ...buildDataFactories(),
    GtkTextView: textViewDescriptors,
    GtkSourceView: sourceViewDescriptors,
};

const tableCache = new WeakMap<Instance, PropDescriptorTable>();

/**
 * Returns the signal/imperative prop descriptors for `instance`, merged across
 * its backing GObject's GType ancestry (most-derived entries win). Cached per
 * instance, since each factory closes over the instance.
 *
 * @param instance - The reconciler instance whose descriptors to resolve.
 */
export const getPropDescriptors = (instance: Instance): PropDescriptorTable => {
    const cached = tableCache.get(instance);
    if (cached) return cached;
    let table: PropDescriptorTable = {};
    const backing = instance.backingInstance;
    if (backing) {
        for (const typeName of collectTypeNameChain(backing.__gtype__)) {
            const factory = PROP_DESCRIPTOR_TABLE[typeName];
            if (factory) table = { ...factory(instance), ...table };
        }
    }
    tableCache.set(instance, table);
    return table;
};
