import { toCamelCase, toCamelIdentifier, uniqBy } from "@gtkx/utils";
import { hasCallerAllocatedArrayLength } from "../../analysis/param-structure.js";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock } from "../../writer/emit.js";
import { matchAsyncFinishName } from "./async.js";
import { callableReferencesClassStruct } from "./class-struct-record.js";
import { renderFnExpression } from "./function.js";
import { gtypeMemberDeclaration } from "./gtype-binding.js";
import {
    methodExportName,
    renderMethodBody,
    renderMethodReturnType,
    renderMethodSignature,
    renderPromisifiedBody,
    renderPromisifiedSignature,
} from "./method.js";
import { renderRuntimeOverride } from "./runtime-override.js";

export type Callables = {
    constructors: GirFunction[];
    functions: GirFunction[];
    methods: GirFunction[];
};

export const dedupeCallables = (callables: GirFunction[]): GirFunction[] =>
    uniqBy(
        callables.filter(
            (callable): callable is GirFunction & { cIdentifier: string } => callable.cIdentifier !== undefined,
        ),
        (callable) => callable.cIdentifier,
    );

export const generateBindings = (context: ModuleContext, callables: Callables): void => {
    const all = [...callables.constructors, ...callables.functions, ...callables.methods];
    for (const callable of all) {
        if (!callable.introspectable) continue;
        if (callable.shadowedBy !== undefined) continue;
        if (callable.cIdentifier === undefined) continue;
        if (callableReferencesClassStruct(context, callable)) continue;
        const expression = renderFnExpression(context, callable);
        if (expression === undefined) continue;
        context.module.appendBinding(
            `const ${toCamelIdentifier(callable.cIdentifier)} = ${expression};`,
            callable.cIdentifier,
        );
    }
};

type CallableMemberOptions = {
    resolveName: (callable: GirFunction) => string | undefined;
    isStatic: boolean;
    returnTypeOverride?: string;
    allowRuntimeOverride?: boolean;
};

const renderCallableMember = (
    context: ModuleContext,
    callable: GirFunction,
    options: CallableMemberOptions,
): string | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const name = options.resolveName(callable);
    if (name === undefined || name === "constructor") return undefined;
    const doc = renderJsDoc(callable.doc);
    if (options.allowRuntimeOverride === true) {
        const override = renderRuntimeOverride(callable, name);
        if (override !== undefined) return `${doc}${override}`;
    }
    const signature = renderMethodSignature(context, callable);
    const returnType = options.returnTypeOverride ?? renderMethodReturnType(context, callable);
    const bindingExpression = toCamelIdentifier(cIdentifier);
    const body = renderMethodBody(context, callable, {
        bindingExpression,
        returnTypeOverride: options.returnTypeOverride,
    });
    return `${doc}${renderBlock(`${options.isStatic ? "static " : ""}${name}(${signature}): ${returnType}`, body)}`;
};

const renderConstructorStatic = (
    context: ModuleContext,
    callable: GirFunction,
    ownerClassName: string,
): string | undefined =>
    renderCallableMember(context, callable, {
        resolveName: (member) => constructorMemberName(member.name),
        isStatic: true,
        returnTypeOverride: ownerClassName,
    });

const renderStaticMember = (context: ModuleContext, callable: GirFunction): string | undefined =>
    renderCallableMember(context, callable, { resolveName: (member) => toCamelCase(member.name), isStatic: true });

const renderInstanceMethod = (
    context: ModuleContext,
    callable: GirFunction,
    nameOverride?: string,
): string | undefined =>
    renderCallableMember(context, callable, {
        resolveName: (member) => nameOverride ?? methodExportName(member),
        isStatic: false,
        allowRuntimeOverride: true,
    });

export const renderInstanceMethodSignature = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: Map<string, GirFunction>,
    nameOverride?: string,
): string | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const name = nameOverride ?? methodExportName(callable);
    if (name === "constructor") return undefined;
    const doc = renderJsDoc(callable.doc);
    const finishFn = matchFinishFunction(context, callable, siblings);
    if (finishFn !== undefined) {
        if (!isEmittableCallable(context, finishFn)) return undefined;
        const { signature, returnType } = renderPromisifiedSignature(context, callable, finishFn);
        return `${doc}${name}(${signature}): ${returnType};`;
    }
    const signature = renderMethodSignature(context, callable);
    const returnType = renderMethodReturnType(context, callable);
    return `${doc}${name}(${signature}): ${returnType};`;
};

export const renderClassInstanceMember = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: Map<string, GirFunction>,
    nameOverride?: string,
): string | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const name = nameOverride ?? methodExportName(callable);
    if (name === "constructor") return undefined;
    const finishFn = matchFinishFunction(context, callable, siblings);
    if (finishFn !== undefined) {
        if (!isEmittableCallable(context, finishFn)) return undefined;
        return renderPromisifiedMember(context, callable, finishFn, name);
    }
    return renderInstanceMethod(context, callable, nameOverride);
};

const matchFinishFunction = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: Map<string, GirFunction>,
): GirFunction | undefined => {
    const finishName = matchAsyncFinishName(context.library, callable, [...siblings.values()]);
    if (finishName === undefined) return undefined;
    return siblings.get(finishName);
};

const renderPromisifiedMember = (
    context: ModuleContext,
    callable: GirFunction,
    finishFn: GirFunction,
    name: string,
): string | undefined => {
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const { signature, returnType } = renderPromisifiedSignature(context, callable, finishFn);
    const finishMember = methodExportName(finishFn);
    const body = renderPromisifiedBody(context, callable, finishMember, toCamelIdentifier(cIdentifier));
    return `${renderJsDoc(callable.doc)}${renderBlock(`${name}(${signature}): ${returnType}`, body)}`;
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
    !callableReferencesClassStruct(context, callable) &&
    !hasCallerAllocatedArrayLength(context.library, callable);

const constructorMemberName = (girName: string): string | undefined => {
    const camel = toCamelCase(girName);
    if (camel === "constructor") return undefined;
    return camel;
};

export const classConstructorMemberNames = (context: ModuleContext, callables: Callables): string[] => {
    const names: string[] = [];
    for (const callable of callables.constructors) {
        if (!isEmittableCallable(context, callable)) continue;
        const member = constructorMemberName(callable.name);
        if (member !== undefined) names.push(member);
    }
    return names;
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

type PlainTypeMembersOptions = {
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
