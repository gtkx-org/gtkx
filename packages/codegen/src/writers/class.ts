import { toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indentMembers, renderBlock } from "../dsl/emit.js";
import { bindingIdentifier } from "../dsl/identifier.js";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import { splitOptionalNamespace } from "../gir/type-ref.js";
import { matchAsyncFinishName } from "./async.js";
import {
    appendMethodBinding,
    type Callables,
    dedupeCallables,
    emitBindings,
    indexMethodsByName,
    renderInstanceMethod,
    renderStaticHead,
} from "./callables.js";
import { renderVfuncMetadata } from "./class-struct.js";
import { renderClassConstructor, renderConstructorPropsInterface } from "./constructor-props.js";
import { gtypeExprFor, gtypeMemberDeclaration } from "./gtype-binding.js";
import {
    collectInheritedMethods,
    collectInterfaceProperties,
    conflictRename,
    type InheritedMethods,
    resolveImplementedInterface,
} from "./inheritance.js";
import { methodExportName, renderPromisifiedBody, renderPromisifiedSignature } from "./method.js";
import { renderPropertyAccessor } from "./property-accessor.js";
import { appendWrapperClassRegistration } from "./registration.js";
import { renderRuntimeOverride } from "./runtime-override.js";
import { renderSignalDeclarations, renderSignalMembers } from "./signal.js";

export const emitClass = (context: ModuleContext, klass: GirClass): void => {
    if (!klass.introspectable) return;
    if (klass.name.length === 0) return;
    const className = toPascalCase(klass.name);
    const callables: Callables = {
        constructors: dedupeCallables(klass.constructors),
        functions: dedupeCallables(klass.functions),
        methods: dedupeCallables(klass.methods),
    };
    emitBindings(context, callables);

    const parentExpression = resolveParent(context, klass);
    const extendsClause = parentExpression === undefined ? "" : ` extends ${parentExpression}`;
    const members = renderClassMembers(context, klass, callables, parentExpression !== undefined);
    const body = indentMembers(members);
    context.module.appendDeclaration(`export class ${className}${extendsClause} {\n${body}\n}`);
    context.module.appendDeclaration(renderConstructorPropsInterface(context, klass, className));
    for (const declaration of renderSignalDeclarations(context, klass, className, false)) {
        context.module.appendDeclaration(declaration);
    }

    const interfaceRefs = klass.implements
        .map((name) => resolveImplementsReference(context, name))
        .filter((entry): entry is string => entry !== undefined);
    if (interfaceRefs.length > 0) {
        context.module.appendDeclaration(`export interface ${className} extends ${interfaceRefs.join(", ")} {}`);
    }

    appendClassRegistrations(context, klass, className);
};

const renderClassMembers = (
    context: ModuleContext,
    klass: GirClass,
    callables: Callables,
    hasParent: boolean,
): string[] => {
    const className = toPascalCase(klass.name);
    const members: string[] = [gtypeMemberDeclaration(context)];
    const constructorBlock = renderClassConstructor(context, klass, className, hasParent);
    if (constructorBlock !== undefined) members.push(constructorBlock);
    const claimedNames = new Set<string>();
    members.push(...renderStaticHead(context, callables, className));
    const inherited = collectInheritedMethods(context, klass);
    const methodByName = indexMethodsByName(callables.methods);
    appendInstanceMethods({
        context,
        methods: callables.methods,
        methodByName,
        inherited,
        members,
        claimedNames,
        className,
    });
    appendFlattenedInterfaceMethods({ context, klass, inheritedNames: inherited.names, members, claimedNames });
    for (const property of klass.properties) {
        const block = renderPropertyAccessor(context, property, claimedNames, methodByName);
        if (block !== undefined) members.push(block);
    }
    for (const property of collectInterfaceProperties(context, klass)) {
        const block = renderPropertyAccessor(context, property, claimedNames, methodByName);
        if (block !== undefined) members.push(block);
    }
    members.push(...renderSignalMembers(context, klass));
    return members;
};

type AppendInstanceMethodsOptions = {
    context: ModuleContext;
    methods: GirFunction[];
    methodByName: Map<string, GirFunction>;
    inherited: InheritedMethods;
    members: string[];
    claimedNames: Set<string>;
    className: string;
};

const appendInstanceMethods = (options: AppendInstanceMethodsOptions): void => {
    const { context, methods, methodByName, inherited, members, claimedNames, className } = options;
    for (const callable of methods) {
        const rename = conflictRename(context, callable, inherited, className);
        const block = renderClassInstanceMember(context, callable, methodByName, rename);
        if (block === undefined) continue;
        members.push(block);
        claimedNames.add(rename ?? methodExportName(callable));
    }
};

type AppendFlattenedInterfaceMethodsOptions = {
    context: ModuleContext;
    klass: GirClass;
    inheritedNames: Set<string>;
    members: string[];
    claimedNames: Set<string>;
};

const appendFlattenedInterfaceMethods = (options: AppendFlattenedInterfaceMethodsOptions): void => {
    const { context, klass, inheritedNames, members, claimedNames } = options;
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(context, implementName);
        if (iface === undefined) continue;
        const methods = dedupeCallables(iface.klass.methods);
        const methodByName = indexMethodsByName(methods);
        for (const method of methods) {
            const name = methodExportName(method);
            if (name === "constructor") continue;
            if (claimedNames.has(name) || inheritedNames.has(name)) continue;
            const block = renderClassInstanceMember(context, method, methodByName);
            if (block === undefined) continue;
            appendMethodBinding(context, method);
            members.push(block);
            claimedNames.add(name);
        }
    }
};

const appendClassRegistrations = (context: ModuleContext, klass: GirClass, className: string): void => {
    const gtypeExpr = gtypeExprFor(context, klass);
    appendWrapperClassRegistration(context, {
        className,
        gtypeExpr,
        vfuncs: renderVfuncMetadata(context, klass),
    });
};

const renderClassInstanceMember = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: Map<string, GirFunction>,
    nameOverride?: string,
): string | undefined => {
    if (!callable.introspectable || callable.shadowedBy !== undefined || callable.cIdentifier === undefined) {
        return undefined;
    }
    const name = nameOverride ?? methodExportName(callable);
    if (name === "constructor") return undefined;
    const override = renderRuntimeOverride(callable, name);
    if (override !== undefined) return override;
    const promisified = renderPromisifiedMember(context, callable, siblings, name);
    if (promisified !== undefined) return promisified;
    return renderInstanceMethod(context, callable, nameOverride);
};

const renderPromisifiedMember = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: Map<string, GirFunction>,
    name: string,
): string | undefined => {
    const finishName = matchAsyncFinishName(context.repository, callable, [...siblings.values()]);
    if (finishName === undefined) return undefined;
    const finishFn = siblings.get(finishName);
    if (finishFn === undefined) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const { signature, returnType } = renderPromisifiedSignature(context, callable, finishFn);
    const finishMember = methodExportName(finishFn);
    const body = renderPromisifiedBody(context, callable, finishMember, bindingIdentifier(cIdentifier));
    return renderBlock(`${name}(${signature}): ${returnType}`, body);
};

const resolveImplementsReference = (context: ModuleContext, name: string): string | undefined => {
    const resolved = context.repository.resolveType(context.namespace.name, name);
    if (resolved === undefined || resolved.kind !== "interface") return undefined;
    return context.qualify(resolved.namespace.name, toPascalCase(resolved.value.name));
};

const resolveParent = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.parent === undefined) return undefined;
    const [namespace, typeName] = splitOptionalNamespace(klass.parent);
    return context.qualify(namespace ?? context.namespace.name, toPascalCase(typeName));
};
