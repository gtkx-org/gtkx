/// <reference types="@gtkx/config/env" />

import { OBJECT_PROPS, PROP_RULES, VIRTUAL_PROPS } from "virtual:gtkx-config";
import type { ObjectPropRow, PropRule, SetterPropGroup, SetterPropStep, VirtualPropRow } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";
import { foldInheritedTableWithInterfaces } from "../utils/gtype.js";
import { ARRAY_PROPS, type ArrayPropDescriptor } from "./array-props.js";
import { runCallSteps, satisfiesCondition } from "./call-steps.js";
import type { PropDiffOverride } from "./prop-diff.js";
import { callMethod, invokeRequiredMethod } from "./reflect-call.js";
import type { Props } from "./types.js";

export interface SignalPropDescriptor extends PropDiffOverride {
    kind: "signal";
    signals: string[];
    blockable?: boolean | undefined;
    getArgs?: (() => unknown[] | null) | undefined;
    returnValue?: unknown;
}

export type ImperativeHandler = (container: GObject.Object, newProps: Props, oldProps: Props | null) => void;

export interface ImperativeDescriptor extends PropDiffOverride {
    kind: "imperative";
    handler: ImperativeHandler;
    always: boolean;
}

export type PropDescriptor = SignalPropDescriptor | ImperativeDescriptor | ArrayPropDescriptor;

export type PropDescriptorTable = Record<string, PropDescriptor>;

export function signal(
    signals: string | string[],
    options?: Omit<SignalPropDescriptor, "kind" | "signals">,
): SignalPropDescriptor {
    return {
        kind: "signal",
        signals: typeof signals === "string" ? [signals] : signals,
        ...options,
    };
}

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
    if (step.call !== undefined) invokeRequiredMethod(container, step.call, [value]);
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

const addRuleRows = (entry: PropDescriptorTable, rules: PropRule[]): void => {
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
        invokeRequiredMethod(container, row.setter, [newProps[prop] ?? null]);
        if (row.after !== undefined) invokeRequiredMethod(container, row.after, []);
    });

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

const DESCRIPTORS_BY_TYPE_NAME: Record<string, PropDescriptorTable> = buildDescriptorsByTypeName();

const descriptorsByGtype = new Map<GObject.GType, PropDescriptorTable>();

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
