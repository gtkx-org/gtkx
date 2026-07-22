import { camelCase, toCamelIdentifier, uniqBy } from "@gtkx/utils";
import { hasCallerAllocatedArrayLength } from "../../analysis/param-structure.js";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock } from "../../writer/emit.js";
import { matchAsyncFinish } from "./async.js";
import { callableReferencesClassStruct } from "./class-struct-record.js";
import { renderFnExpression } from "./function.js";
import { gtypeMemberDeclaration } from "./gtype-binding.js";
import {
    boundFinishExpression,
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
    returnTypeOverride?: string | undefined;
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

type StaticEntryOptions = {
    resolveName: (callable: GirFunction) => string | undefined;
    returnTypeOverride?: string | undefined;
};

const renderStaticEntry = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: GirFunction[],
    options: StaticEntryOptions,
): string | undefined => {
    const finishFn = matchStaticFinishFunction(context, callable, siblings);
    if (finishFn !== undefined) {
        const name = options.resolveName(callable);
        if (name === undefined || name === "constructor") return undefined;
        return renderPromisifiedCallable(context, callable, finishFn, { name, isStatic: true });
    }
    return renderCallableMember(context, callable, {
        resolveName: options.resolveName,
        isStatic: true,
        returnTypeOverride: options.returnTypeOverride,
    });
};

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

type ResolvedInstanceMember = {
    name: string;
    finishFn: GirFunction | undefined;
};

const resolveInstanceMember = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: Map<string, GirFunction>,
    nameOverride?: string,
): ResolvedInstanceMember | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const name = nameOverride ?? methodExportName(callable);
    if (name === "constructor") return undefined;
    const finishFn = matchFinishFunction(context, callable, siblings);
    if (finishFn !== undefined && !isEmittableCallable(context, finishFn)) return undefined;
    return { name, finishFn };
};

type InstanceMemberRenderer = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: Map<string, GirFunction>,
    nameOverride?: string,
) => string | undefined;

const instanceMemberRenderer =
    (
        render: (context: ModuleContext, callable: GirFunction, member: ResolvedInstanceMember) => string | undefined,
    ): InstanceMemberRenderer =>
    (context, callable, siblings, nameOverride) => {
        const member = resolveInstanceMember(context, callable, siblings, nameOverride);
        return member === undefined ? undefined : render(context, callable, member);
    };

export const renderInstanceMethodSignature: InstanceMemberRenderer = instanceMemberRenderer(
    (context, callable, { name, finishFn }) => {
        const doc = renderJsDoc(callable.doc);
        if (finishFn !== undefined) {
            const { signature, returnType } = renderPromisifiedSignature(context, callable, finishFn);
            return `${doc}${name}(${signature}): ${returnType};`;
        }
        const signature = renderMethodSignature(context, callable);
        const returnType = renderMethodReturnType(context, callable);
        return `${doc}${name}(${signature}): ${returnType};`;
    },
);

export const renderClassInstanceMember: InstanceMemberRenderer = instanceMemberRenderer(
    (context, callable, { name, finishFn }) =>
        finishFn !== undefined
            ? renderPromisifiedCallable(context, callable, finishFn, { name, isStatic: false })
            : renderInstanceMethod(context, callable, name),
);

const matchFinishFunction = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: Map<string, GirFunction>,
): GirFunction | undefined => matchAsyncFinish(context.library, callable, [...siblings.values()]);

export const matchStaticFinishFunction = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: GirFunction[],
): GirFunction | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const finishFn = matchAsyncFinish(context.library, callable, siblings);
    if (finishFn === undefined || !isEmittableCallable(context, finishFn)) return undefined;
    return finishFn;
};

const renderPromisifiedCallable = (
    context: ModuleContext,
    callable: GirFunction,
    finishFn: GirFunction,
    member: { name: string; isStatic: boolean },
): string | undefined => {
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const { signature, returnType } = renderPromisifiedSignature(context, callable, finishFn);
    const body = renderPromisifiedBody(
        context,
        callable,
        boundFinishExpression(finishFn),
        toCamelIdentifier(cIdentifier),
    );
    const prefix = member.isStatic ? "static " : "";
    return `${renderJsDoc(callable.doc)}${renderBlock(`${prefix}${member.name}(${signature}): ${returnType}`, body)}`;
};

export const indexMethodsByName = (methods: GirFunction[]): Map<string, GirFunction> => {
    const map = new Map<string, GirFunction>();
    for (const callable of methods) map.set(callable.name, callable);
    return map;
};

export const isEmittableCallable = (context: ModuleContext, callable: GirFunction): boolean =>
    callable.introspectable &&
    callable.shadowedBy === undefined &&
    callable.cIdentifier !== undefined &&
    !callableReferencesClassStruct(context, callable) &&
    !hasCallerAllocatedArrayLength(context.library, callable);

const constructorMemberName = (girName: string): string | undefined => {
    const camel = camelCase(girName);
    if (camel === "constructor") return undefined;
    return camel;
};

export const renderStaticSignature = (
    context: ModuleContext,
    callable: GirFunction,
    options?: { returnTypeOverride?: string | undefined; siblings?: GirFunction[] | undefined },
): { name: string; signature: string } | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const name = constructorMemberName(callable.name);
    if (name === undefined) return undefined;
    const finishFn =
        options?.siblings === undefined ? undefined : matchStaticFinishFunction(context, callable, options.siblings);
    if (finishFn !== undefined) {
        const { signature, returnType } = renderPromisifiedSignature(context, callable, finishFn);
        return { name, signature: `${name}(${signature}): ${returnType}` };
    }
    const parameters = renderMethodSignature(context, callable);
    const returnType = options?.returnTypeOverride ?? renderMethodReturnType(context, callable);
    return { name, signature: `${name}(${parameters}): ${returnType}` };
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
    const siblings = [...callables.constructors, ...callables.functions];
    const blocks: string[] = [];
    for (const callable of callables.constructors) {
        const block = renderStaticEntry(context, callable, siblings, {
            resolveName: (member) => constructorMemberName(member.name),
            returnTypeOverride: ownerClassName,
        });
        if (block !== undefined) blocks.push(block);
    }
    for (const callable of callables.functions) {
        const block = renderStaticEntry(context, callable, siblings, {
            resolveName: (member) => camelCase(member.name),
        });
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
