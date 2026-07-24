/// <reference types="@gtkx/config/env" />
import {
    CONSTRUCT_ONLY_PROPS,
    CONSTRUCT_PROPS,
    DEFAULT_PROPS,
    ELEMENT_PROPS,
    SIGNALS,
    userEventSignals,
} from "virtual:gtkx-config";
import type { ContainerProp, ControlledTextProp, ElementProp, LazyProp, ListProp, ValueProp } from "@gtkx/config";
import { getSignalBaseName, TYPE_INVALID, typeFromName, typeInterfaces, typeName, typeParent } from "@gtkx/runtime";
import { behaviorFor, type ContainerBehavior, type ListBehavior, listBehaviorFor } from "./element-rules.js";

export type TypeInfo = {
    typeName: string;
    signals: Record<string, string>;
    userEventSignals: Set<string>;
    containerRules: ContainerProp[];
    containerBehaviors: Map<string, ContainerBehavior>;
    containerProps: Set<string>;
    valueProps: Map<string, ValueProp>;
    listProps: Map<string, ListProp>;
    listBehaviors: Map<string, ListBehavior>;
    lazyProps: Map<string, LazyProp>;
    controlledText: Map<string, ControlledTextProp>;
    constructOnly: Set<string>;
    construct: Set<string>;
    defaults: Record<string, unknown>;
};

const ancestryCache = new Map<string, string[]>();
const typeInfoCache = new Map<string, TypeInfo>();

const addAncestor = (names: string[], seen: Set<string>, name: string | null): void => {
    if (name !== null && !seen.has(name)) {
        seen.add(name);
        names.push(name);
    }
};

const ancestryOf = (name: string): string[] => {
    const cached = ancestryCache.get(name);
    if (cached !== undefined) return cached;
    const names: string[] = [];
    const seen = new Set<string>();
    let type = typeFromName(name);
    while (type !== TYPE_INVALID) {
        addAncestor(names, seen, typeName(type));
        for (const iface of typeInterfaces(type)) addAncestor(names, seen, typeName(iface));
        type = typeParent(type);
    }
    ancestryCache.set(name, names);
    return names;
};

const classifyProps = (owner: string, rules: ElementProp[], info: TypeInfo): void => {
    for (const rule of rules) {
        if (rule.kind === "container") {
            info.containerRules.push(rule);
            info.containerProps.add(rule.prop);
            const key = `${rule.prop}:${rule.child}`;
            const behavior = behaviorFor(owner, rule.prop, rule.child);
            if (behavior !== undefined && !info.containerBehaviors.has(key)) info.containerBehaviors.set(key, behavior);
        } else if (rule.kind === "value") {
            info.valueProps.set(rule.prop, rule);
        } else if (rule.kind === "list") {
            info.listProps.set(rule.prop, rule);
            const listBehavior = listBehaviorFor(owner, rule.prop);
            if (listBehavior !== undefined && !info.listBehaviors.has(rule.prop)) {
                info.listBehaviors.set(rule.prop, listBehavior);
            }
        } else if (rule.kind === "lazy") {
            info.lazyProps.set(rule.prop, rule);
        } else {
            info.controlledText.set(rule.prop, rule);
        }
    }
};

const buildTypeInfo = (name: string): TypeInfo => {
    const chain = ancestryOf(name);
    const info: TypeInfo = {
        typeName: name,
        signals: {},
        userEventSignals: new Set(),
        containerRules: [],
        containerBehaviors: new Map(),
        containerProps: new Set(),
        valueProps: new Map(),
        listProps: new Map(),
        listBehaviors: new Map(),
        lazyProps: new Map(),
        controlledText: new Map(),
        constructOnly: new Set(),
        construct: new Set(),
        defaults: {},
    };
    for (const ancestor of chain) {
        Object.assign(info.signals, SIGNALS[ancestor] ?? {});
        for (const signal of userEventSignals[ancestor] ?? []) info.userEventSignals.add(signal);
        for (const prop of CONSTRUCT_ONLY_PROPS[ancestor] ?? []) info.constructOnly.add(prop);
        for (const prop of CONSTRUCT_PROPS[ancestor] ?? []) info.construct.add(prop);
        classifyProps(ancestor, ELEMENT_PROPS[ancestor] ?? [], info);
    }
    for (const ancestor of [...chain].reverse()) Object.assign(info.defaults, DEFAULT_PROPS[ancestor] ?? {});
    return info;
};

export const typeInfoOf = (name: string): TypeInfo => {
    const cached = typeInfoCache.get(name);
    if (cached !== undefined) return cached;
    const info = buildTypeInfo(name);
    typeInfoCache.set(name, info);
    return info;
};

export const isBlockableSignal = (info: TypeInfo, signal: string): boolean =>
    info.userEventSignals.has(getSignalBaseName(signal));
