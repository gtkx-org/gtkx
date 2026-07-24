/// <reference types="@gtkx/config/env" />
import {
    CONSTRUCT_ONLY_PROPS,
    CONSTRUCT_PROPS,
    DEFAULT_PROPS,
    elementProps,
    SIGNALS,
    userEventSignals,
} from "virtual:gtkx-config";
import { getSignalBaseName, TYPE_INVALID, typeFromName, typeInterfaces, typeName, typeParent } from "@gtkx/runtime";
import {
    type ContainerRule,
    ELEMENT_RULES,
    type ElementRule,
    type LazyRule,
    type ListRule,
    registerElementProps,
    type ValueRule,
} from "./element-rules.js";

export type TypeInfo = {
    typeName: string;
    signals: Record<string, string>;
    userEventSignals: Set<string>;
    containerRules: ContainerRule[];
    containerProps: Set<string>;
    valueProps: Map<string, ValueRule>;
    listProps: Map<string, ListRule>;
    lazyProps: Map<string, LazyRule>;
    controlledText: Set<string>;
    constructOnly: Set<string>;
    construct: Set<string>;
    defaults: Record<string, unknown>;
};

registerElementProps(elementProps);

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

const classifyProps = (rules: ElementRule[], info: TypeInfo): void => {
    for (const rule of rules) {
        if (rule.kind === "container") {
            info.containerRules.push(rule);
            info.containerProps.add(rule.prop);
        } else if (rule.kind === "value") {
            info.valueProps.set(rule.prop, rule);
        } else if (rule.kind === "list") {
            info.listProps.set(rule.prop, rule);
        } else if (rule.kind === "lazy") {
            info.lazyProps.set(rule.prop, rule);
        } else {
            info.controlledText.add(rule.prop);
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
        containerProps: new Set(),
        valueProps: new Map(),
        listProps: new Map(),
        lazyProps: new Map(),
        controlledText: new Set(),
        constructOnly: new Set(),
        construct: new Set(),
        defaults: {},
    };
    for (const ancestor of chain) {
        Object.assign(info.signals, SIGNALS[ancestor] ?? {});
        for (const signal of userEventSignals[ancestor] ?? []) info.userEventSignals.add(signal);
        for (const prop of CONSTRUCT_ONLY_PROPS[ancestor] ?? []) info.constructOnly.add(prop);
        for (const prop of CONSTRUCT_PROPS[ancestor] ?? []) info.construct.add(prop);
        classifyProps(ELEMENT_RULES[ancestor] ?? [], info);
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
