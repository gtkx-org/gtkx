import { dedupeBy, toCamelCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { renderBlock } from "../dsl/emit.js";
import { bindingIdentifier } from "../dsl/identifier.js";
import type { GirFunction } from "../gir/function.js";
import { callableReferencesClassStruct } from "./class-struct-record.js";
import { renderFnExpression } from "./function.js";
import { gtypeMemberDeclaration } from "./gtype-binding.js";
import { methodExportName, renderMethodBody, renderMethodReturnType, renderMethodSignature } from "./method.js";
import { renderRuntimeOverride } from "./runtime-override.js";

export type Callables = {
    constructors: GirFunction[];
    functions: GirFunction[];
    methods: GirFunction[];
};

export const dedupeCallables = (callables: GirFunction[]): GirFunction[] =>
    dedupeBy(
        callables.filter(
            (callable): callable is GirFunction & { cIdentifier: string } => callable.cIdentifier !== undefined,
        ),
        (callable) => callable.cIdentifier,
    );

export const emitBindings = (context: ModuleContext, callables: Callables): void => {
    const all = [...callables.constructors, ...callables.functions, ...callables.methods];
    for (const callable of all) {
        if (!callable.introspectable) continue;
        if (callable.shadowedBy !== undefined) continue;
        if (callable.cIdentifier === undefined) continue;
        if (callableReferencesClassStruct(context, callable)) continue;
        const expression = renderFnExpression(context, callable);
        if (expression === undefined) continue;
        context.module.appendBinding(
            `const ${bindingIdentifier(callable.cIdentifier)} = ${expression};`,
            callable.cIdentifier,
        );
    }
};

const renderConstructorStatic = (
    context: ModuleContext,
    callable: GirFunction,
    ownerClassName: string,
): string | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const name = constructorMemberName(callable.name);
    if (name === undefined) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const signature = renderMethodSignature(context, callable);
    const body = renderMethodBody(context, callable, {
        bindingExpression: bindingIdentifier(cIdentifier),
        returnTypeOverride: ownerClassName,
    });
    return renderBlock(`static ${name}(${signature}): ${ownerClassName}`, body);
};

const renderStaticMember = (context: ModuleContext, callable: GirFunction): string | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const name = toCamelCase(callable.name);
    if (name === "constructor") return undefined;
    const signature = renderMethodSignature(context, callable);
    const returnType = renderMethodReturnType(context, callable);
    const body = renderMethodBody(context, callable, {
        bindingExpression: bindingIdentifier(cIdentifier),
    });
    return renderBlock(`static ${name}(${signature}): ${returnType}`, body);
};

export const renderInstanceMethod = (
    context: ModuleContext,
    callable: GirFunction,
    nameOverride?: string,
): string | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const name = nameOverride ?? methodExportName(callable);
    if (name === "constructor") return undefined;
    const override = renderRuntimeOverride(callable, name);
    if (override !== undefined) return override;
    const signature = renderMethodSignature(context, callable);
    const returnType = renderMethodReturnType(context, callable);
    const body = renderMethodBody(context, callable, {
        bindingExpression: bindingIdentifier(cIdentifier),
    });
    return renderBlock(`${name}(${signature}): ${returnType}`, body);
};

export const renderInstanceMethodSignature = (
    context: ModuleContext,
    callable: GirFunction,
    nameOverride?: string,
): string | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const name = nameOverride ?? methodExportName(callable);
    if (name === "constructor") return undefined;
    const signature = renderMethodSignature(context, callable);
    const returnType = renderMethodReturnType(context, callable);
    return `${name}(${signature}): ${returnType};`;
};

export const indexMethodsByName = (methods: GirFunction[]): Map<string, GirFunction> => {
    const map = new Map<string, GirFunction>();
    for (const callable of methods) map.set(callable.name, callable);
    return map;
};

const isEmittableCallable = (context: ModuleContext, callable: GirFunction): boolean =>
    callable.introspectable &&
    callable.shadowedBy === undefined &&
    callable.cIdentifier !== undefined &&
    !callableReferencesClassStruct(context, callable);

const constructorMemberName = (girName: string): string | undefined => {
    const camel = toCamelCase(girName);
    if (camel === "constructor") return undefined;
    return camel;
};

export const renderStaticHead = (context: ModuleContext, callables: Callables, ownerClassName: string): string[] => {
    const blocks: string[] = [];
    for (const callable of callables.constructors) {
        const block = renderConstructorStatic(context, callable, ownerClassName);
        if (block !== undefined) blocks.push(block);
    }
    for (const callable of callables.functions) {
        const block = renderStaticMember(context, callable);
        if (block !== undefined) blocks.push(block);
    }
    return blocks;
};

const renderPlainInstanceMethods = (
    context: ModuleContext,
    methods: GirFunction[],
    claimedNames: Set<string>,
): string[] => {
    const blocks: string[] = [];
    for (const callable of methods) {
        const block = renderInstanceMethod(context, callable);
        if (block === undefined) continue;
        blocks.push(block);
        claimedNames.add(methodExportName(callable));
    }
    return blocks;
};

export type PlainTypeMembersOptions = {
    context: ModuleContext;
    className: string;
    callables: Callables;
    hasGtype: boolean;
};

export const renderPlainTypeMembers = (
    options: PlainTypeMembersOptions,
): { members: string[]; claimedNames: Set<string> } => {
    const { context, className, callables, hasGtype } = options;
    const members: string[] = [];
    if (hasGtype) members.push(gtypeMemberDeclaration(context));
    const claimedNames = new Set<string>();
    members.push(...renderStaticHead(context, callables, className));
    members.push(...renderPlainInstanceMethods(context, callables.methods, claimedNames));
    return { members, claimedNames };
};
