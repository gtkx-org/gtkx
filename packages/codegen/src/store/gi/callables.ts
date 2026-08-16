import { toCamelIdentifier, uniqBy } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import type { JsDocSpec } from "../../writer/doc.js";
import { hasUnmarshalableParam } from "../../analysis/param-capability.js";
import { renderBlock } from "../../writer/emit.js";
import { matchAsyncFinish } from "./async.js";
import { callableDoc, callableSpec } from "./callable-doc.js";
import { renderFnExpression } from "./function.js";
import { gtypeMemberDeclaration } from "./gtype-binding.js";
import {
    finishCallExpression,
    memberName,
    methodExportName,
    renderMethodBody,
    renderMethodReturnType,
    renderMethodSignature,
    renderPromisifiedBody,
    renderPromisifiedSignature,
} from "./method.js";
import { renderRuntimeOverride, runtimeOverrideRenames } from "./runtime-override.js";

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
    canUseRuntimeOverride?: boolean;
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

type StaticMember = {
    callable: GirFunction;
    name: string;
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

const RUNTIME_OWNED_LIFETIME_METHODS: Set<string> = new Set([
    "force_floating",
    "free",
    "ref",
    "ref_sink",
    "take_ref",
    "unref",
]);

const renderInstanceMethodSignature: InstanceMemberRenderer = instanceMemberRenderer(
    (context, callable, { name, finishFn }) =>
        `${memberDoc(context, callable, finishFn)}${memberSignatureText(context, callable, name, { finishFn })};`,
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

const memberDoc = (context: ModuleContext, callable: GirFunction, finishFn: GirFunction | undefined): string =>
    callableDoc(context, callable, { finishFn });

const instanceMemberSpec = (context: ModuleContext, callable: GirFunction, scope: InstanceScope): JsDocSpec =>
    callableSpec(context, callable, { finishFn: matchFinishFunction(context, callable, scope) });

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

const getEmittableCIdentifier = (context: ModuleContext, callable: GirFunction): string | undefined =>
    isEmittableCallable(context, callable) ? callable.cIdentifier : undefined;

const renderBinding = (
    context: ModuleContext,
    callable: GirFunction,
): { text: string; cIdentifier: string } | undefined => {
    const cIdentifier = getEmittableCIdentifier(context, callable);

    if (cIdentifier === undefined) {
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
    const cIdentifier = getEmittableCIdentifier(context, callable);

    if (cIdentifier === undefined) {
        return undefined;
    }

    const name = resolveName(callable);

    if (name === undefined || !isEmittableMemberName(name)) {
        return undefined;
    }

    return { cIdentifier, name };
};

const runtimeOverrideMember = (
    callable: GirFunction,
    name: string,
    doc: string,
    canUseRuntimeOverride: boolean | undefined,
): string | undefined => {
    if (canUseRuntimeOverride !== true) {
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
    const renames = options.canUseRuntimeOverride === true ? runtimeOverrideRenames(callable) : undefined;
    const doc = callableDoc(context, callable, { renames });
    const override = runtimeOverrideMember(callable, name, doc, options.canUseRuntimeOverride);

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

        if (name === undefined || !isEmittableMemberName(name)) {
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
        canUseRuntimeOverride: true,
    });

const isEmittableMemberName = (name: string): boolean => name !== "constructor" && name.length > 0;

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

    if (!isEmittableMemberName(name)) {
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

    return `${memberDoc(context, callable, finishFn)}${renderBlock(header, body)}`;
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
    !RUNTIME_OWNED_LIFETIME_METHODS.has(callable.name) &&
    !hasUnmarshalableParam(context, callable);

const constructorMemberName = (girName: string): string | undefined => {
    const camel = memberName(girName);

    return isEmittableMemberName(camel) ? camel : undefined;
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

const staticMemberName = (
    context: ModuleContext,
    callable: GirFunction,
    resolveName: (girName: string) => string | undefined,
): string | undefined => {
    if (!isEmittableCallable(context, callable)) {
        return undefined;
    }

    const name = resolveName(callable.name);

    return name !== undefined && isEmittableMemberName(name) ? name : undefined;
};

const collectStaticMembers = (
    context: ModuleContext,
    group: GirFunction[],
    resolveName: (girName: string) => string | undefined,
): StaticMember[] => {
    const members: StaticMember[] = [];

    for (const callable of group) {
        const name = staticMemberName(context, callable, resolveName);

        if (name !== undefined) {
            members.push({ callable, name });
        }
    }

    return members;
};

const staticMembers = (context: ModuleContext, callables: Callables): StaticMember[] => [
    ...collectStaticMembers(context, callables.constructors, memberName),
    ...collectStaticMembers(context, callables.functions, memberName),
];

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
            resolveName: (member) => memberName(member.name),
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
    instanceMemberSpec,
    instanceScope,
    dedupeCallables,
    generateBindings,
    matchStaticFinishFunction,
    isEmittableCallable,
    renderStaticSignature,
    renderStaticHead,
    renderPlainTypeMembers,
    staticMembers,
    type Callables,
    type InstanceMemberRenderer,
    type InstanceScope,
};
