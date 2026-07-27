import { camelCase, toCamelIdentifier, uniqBy } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import { hasCallerAllocatedArrayLength } from "../../analysis/param-structure.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock } from "../../writer/emit.js";
import { matchAsyncFinish } from "./async.js";
import { hasClassStructReference } from "./class-struct-record.js";
import { renderFnExpression } from "./function.js";
import { gtypeMemberDeclaration } from "./gtype-binding.js";
import {
    finishCallExpression,
    methodExportName,
    renderMethodBody,
    renderMethodReturnType,
    renderMethodSignature,
    renderPromisifiedBody,
    renderPromisifiedSignature,
} from "./method.js";
import { renderRuntimeOverride } from "./runtime-override.js";

type Callables = {
    constructors: GirFunction[];
    functions: GirFunction[];
    methods: GirFunction[];
};

type InstanceScope = {
    ownerName: string;
    methodByName: Map<string, GirFunction>;
    statics: GirFunction[];
};

type CallableMemberOptions = {
    resolveName: (callable: GirFunction) => string | undefined;
    isStatic: boolean;
    returnTypeOverride?: string | undefined;
    allowRuntimeOverride?: boolean;
};

type StaticEntryOptions = {
    resolveName: (callable: GirFunction) => string | undefined;
    ownerName: string;
    returnTypeOverride?: string | undefined;
};

type ResolvedInstanceMember = {
    name: string;
    finishFn: GirFunction | undefined;
};

type InstanceMemberRenderer = (
    context: ModuleContext,
    callable: GirFunction,
    scope: InstanceScope,
    nameOverride?: string,
) => string | undefined;

type PlainTypeMembersOptions = {
    context: ModuleContext;
    className: string;
    callables: Callables;
    hasGtype: boolean;
};

const renderInstanceMethodSignature: InstanceMemberRenderer = instanceMemberRenderer(
    (context, callable, { name, finishFn }) =>
        `${renderJsDoc(callable.doc)}${memberSignatureText(context, callable, name, { finishFn })};`,
);

const renderClassInstanceMember: InstanceMemberRenderer = instanceMemberRenderer(
    (context, callable, { name, finishFn }, scope) =>
        finishFn === undefined
            ? renderInstanceMethod(context, callable, name)
            : renderPromisifiedCallable(context, callable, finishFn, {
                    name,
                    isStatic: false,
                    ownerName: scope.ownerName,
                }),
);

const instanceScope = (ownerName: string, callables: Callables): InstanceScope => ({
    ownerName,
    methodByName: indexMethodsByName(callables.methods),
    statics: [...callables.constructors, ...callables.functions],
});

const dedupeCallables = (callables: GirFunction[]): GirFunction[] =>
    uniqBy(
        callables.filter(
            (callable): callable is GirFunction & { cIdentifier: string } => callable.cIdentifier !== undefined,
        ),
        (callable) => callable.cIdentifier,
    );

const renderBinding = (
    context: ModuleContext,
    callable: GirFunction,
): { text: string; cIdentifier: string } | undefined => {
    if (!callable.introspectable) {
        return undefined;
    }

    if (callable.shadowedBy !== undefined) {
        return undefined;
    }

    const cIdentifier = callable.cIdentifier;

    if (cIdentifier === undefined) {
        return undefined;
    }

    if (hasClassStructReference(context, callable)) {
        return undefined;
    }

    const expression = renderFnExpression(context, callable);

    if (expression === undefined) {
        return undefined;
    }

    return { text: `const ${toCamelIdentifier(cIdentifier)} = ${expression};`, cIdentifier };
};

const generateBindings = (context: ModuleContext, callables: Callables): void => {
    const all = [...callables.constructors, ...callables.functions, ...callables.methods];

    for (const callable of all) {
        const binding = renderBinding(context, callable);

        if (binding !== undefined) {
            context.module.appendBinding(binding.text, binding.cIdentifier);
        }
    }
};

const resolveCallableMember = (
    context: ModuleContext,
    callable: GirFunction,
    resolveName: (callable: GirFunction) => string | undefined,
): { cIdentifier: string; name: string } | undefined => {
    if (!isEmittableCallable(context, callable)) {
        return undefined;
    }

    const cIdentifier = callable.cIdentifier;

    if (cIdentifier === undefined) {
        return undefined;
    }

    const name = resolveName(callable);

    if (name === undefined || name === "constructor") {
        return undefined;
    }

    return { cIdentifier, name };
};

const runtimeOverrideMember = (
    callable: GirFunction,
    name: string,
    doc: string,
    allow: boolean | undefined,
): string | undefined => {
    if (allow !== true) {
        return undefined;
    }

    const override = renderRuntimeOverride(callable, name);

    return override === undefined ? undefined : `${doc}${override}`;
};

const renderCallableMember = (
    context: ModuleContext,
    callable: GirFunction,
    options: CallableMemberOptions,
): string | undefined => {
    const resolved = resolveCallableMember(context, callable, options.resolveName);

    if (resolved === undefined) {
        return undefined;
    }

    const { cIdentifier, name } = resolved;
    const doc = renderJsDoc(callable.doc);
    const override = runtimeOverrideMember(callable, name, doc, options.allowRuntimeOverride);

    if (override !== undefined) {
        return override;
    }

    const signature = renderMethodSignature(context, callable);
    const returnType = options.returnTypeOverride ?? renderMethodReturnType(context, callable);

    const body = renderMethodBody(context, callable, {
        bindingExpression: toCamelIdentifier(cIdentifier),
        returnTypeOverride: options.returnTypeOverride,
    });

    const prefix = options.isStatic ? "static " : "";
    const header = `${prefix}${name}(${signature}): ${returnType}`;

    return `${doc}${renderBlock(header, body)}`;
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

        if (name === undefined || name === "constructor") {
            return undefined;
        }

        return renderPromisifiedCallable(context, callable, finishFn, {
            name,
            isStatic: true,
            ownerName: options.ownerName,
        });
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

const resolveInstanceMember = (
    context: ModuleContext,
    callable: GirFunction,
    scope: InstanceScope,
    nameOverride?: string,
): ResolvedInstanceMember | undefined => {
    if (!isEmittableCallable(context, callable)) {
        return undefined;
    }

    const name = nameOverride ?? methodExportName(callable);

    if (name === "constructor") {
        return undefined;
    }

    const finishFn = matchFinishFunction(context, callable, scope);

    if (finishFn !== undefined && !isEmittableCallable(context, finishFn)) {
        return undefined;
    }

    return { name, finishFn };
};

function instanceMemberRenderer(
    render: (
        context: ModuleContext,
        callable: GirFunction,
        member: ResolvedInstanceMember,
        scope: InstanceScope,
    ) => string | undefined,
): InstanceMemberRenderer {
    return (context, callable, scope, nameOverride) => {
        const member = resolveInstanceMember(context, callable, scope, nameOverride);

        return member === undefined ? undefined : render(context, callable, member, scope);
    };
}

const memberSignatureText = (
    context: ModuleContext,
    callable: GirFunction,
    name: string,
    options: { finishFn: GirFunction | undefined; returnTypeOverride?: string | undefined },
): string => {
    const promisified =
        options.finishFn === undefined ? undefined : renderPromisifiedSignature(context, callable, options.finishFn);

    const signature = promisified?.signature ?? renderMethodSignature(context, callable);

    const returnType =
        promisified?.returnType ?? options.returnTypeOverride ?? renderMethodReturnType(context, callable);

    return `${name}(${signature}): ${returnType}`;
};

const matchFinishFunction = (
    context: ModuleContext,
    callable: GirFunction,
    scope: InstanceScope,
): GirFunction | undefined =>
    matchAsyncFinish(context.library, callable, [...scope.methodByName.values(), ...scope.statics]);

const matchStaticFinishFunction = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: GirFunction[],
): GirFunction | undefined => {
    if (!isEmittableCallable(context, callable)) {
        return undefined;
    }

    const finishFn = matchAsyncFinish(context.library, callable, siblings);

    if (finishFn === undefined || !isEmittableCallable(context, finishFn)) {
        return undefined;
    }

    return finishFn;
};

const renderPromisifiedCallable = (
    context: ModuleContext,
    callable: GirFunction,
    finishFn: GirFunction,
    member: { name: string; isStatic: boolean; ownerName: string },
): string | undefined => {
    const cIdentifier = callable.cIdentifier;

    if (cIdentifier === undefined) {
        return undefined;
    }

    const { signature, returnType } = renderPromisifiedSignature(context, callable, finishFn);

    const body = renderPromisifiedBody(
        context,
        callable,
        finishCallExpression(callable, finishFn, member.ownerName),
        toCamelIdentifier(cIdentifier),
    );

    const prefix = member.isStatic ? "static " : "";
    const header = `${prefix}${member.name}(${signature}): ${returnType}`;

    return `${renderJsDoc(callable.doc)}${renderBlock(header, body)}`;
};

const indexMethodsByName = (methods: GirFunction[]): Map<string, GirFunction> => {
    const map: Map<string, GirFunction> = new Map();

    for (const callable of methods) {
        map.set(callable.name, callable);
    }

    return map;
};

const isEmittableCallable = (context: ModuleContext, callable: GirFunction): boolean =>
    callable.introspectable &&
    callable.shadowedBy === undefined &&
    callable.cIdentifier !== undefined &&
    !hasClassStructReference(context, callable) &&
    !hasCallerAllocatedArrayLength(context.library, callable);

const constructorMemberName = (girName: string): string | undefined => {
    const camel = camelCase(girName);

    if (camel === "constructor") {
        return undefined;
    }

    return camel;
};

const renderStaticSignature = (
    context: ModuleContext,
    callable: GirFunction,
    options?: { returnTypeOverride?: string | undefined; siblings?: GirFunction[] | undefined },
): { name: string; signature: string } | undefined => {
    if (!isEmittableCallable(context, callable)) {
        return undefined;
    }

    const name = constructorMemberName(callable.name);

    if (name === undefined) {
        return undefined;
    }

    const finishFn =
        options?.siblings === undefined ? undefined : matchStaticFinishFunction(context, callable, options.siblings);

    return {
        name,
        signature: memberSignatureText(context, callable, name, {
            finishFn,
            returnTypeOverride: options?.returnTypeOverride,
        }),
    };
};

const classConstructorMemberNames = (context: ModuleContext, callables: Callables): string[] => {
    const names: string[] = [];

    for (const callable of callables.constructors) {
        if (!isEmittableCallable(context, callable)) {
            continue;
        }

        const member = constructorMemberName(callable.name);

        if (member !== undefined) {
            names.push(member);
        }
    }

    return names;
};

const collectStaticEntries = (
    context: ModuleContext,
    group: GirFunction[],
    siblings: GirFunction[],
    options: StaticEntryOptions,
): string[] => {
    const blocks: string[] = [];

    for (const callable of group) {
        const block = renderStaticEntry(context, callable, siblings, options);

        if (block !== undefined) {
            blocks.push(block);
        }
    }

    return blocks;
};

const renderStaticHead = (context: ModuleContext, callables: Callables, ownerClassName: string): string[] => {
    const siblings = [...callables.constructors, ...callables.functions];

    return [
        ...collectStaticEntries(context, callables.constructors, siblings, {
            resolveName: (member) => constructorMemberName(member.name),
            ownerName: ownerClassName,
            returnTypeOverride: ownerClassName,
        }),
        ...collectStaticEntries(context, callables.functions, siblings, {
            resolveName: (member) => camelCase(member.name),
            ownerName: ownerClassName,
        }),
    ];
};

const renderPlainInstanceMethods = (
    context: ModuleContext,
    methods: GirFunction[],
    claimedNames: Set<string>,
): string[] => {
    const blocks: string[] = [];

    for (const callable of methods) {
        const block = renderInstanceMethod(context, callable);

        if (block === undefined) {
            continue;
        }

        blocks.push(block);
        claimedNames.add(methodExportName(callable));
    }

    return blocks;
};

const renderPlainTypeMembers = (
    options: PlainTypeMembersOptions,
): { members: string[]; claimedNames: Set<string> } => {
    const { context, className, callables, hasGtype } = options;
    const claimedNames: Set<string> = new Set();

    const members: string[] = [
        ...(hasGtype ? [gtypeMemberDeclaration(context)] : []),
        ...renderStaticHead(context, callables, className),
        ...renderPlainInstanceMethods(context, callables.methods, claimedNames),
    ];

    return { members, claimedNames };
};

export {
    renderInstanceMethodSignature,
    renderClassInstanceMember,
    instanceScope,
    dedupeCallables,
    generateBindings,
    matchStaticFinishFunction,
    indexMethodsByName,
    isEmittableCallable,
    renderStaticSignature,
    classConstructorMemberNames,
    renderStaticHead,
    renderPlainTypeMembers,
    type Callables,
    type InstanceScope,
};
