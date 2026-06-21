import { toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indentMembers, renderBlock } from "../dsl/emit.js";
import { bindingIdentifier } from "../dsl/identifier.js";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import { splitOptionalNamespace } from "../gir/type-ref.js";
import { matchAsyncFinishName } from "./async.js";
import {
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
import { collectInheritedMethods, conflictRename, type InheritedMethods } from "./inheritance.js";
import { methodExportName, renderPromisifiedBody, renderPromisifiedSignature } from "./method.js";
import { renderPropertyAccessor } from "./property-accessor.js";
import { appendWrapperClassRegistration } from "./registration.js";
import { renderRuntimeOverride } from "./runtime-override.js";
import { renderSignalDeclarations, renderSignalMembers } from "./signal.js";

type ImplementedRef = {
    typeRef: string;
    makerRef: string;
};

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
    const implemented = resolveImplementedRefs(context, klass);
    const typeRefs = implemented.map((ref) => ref.typeRef);
    const implementsClause = typeRefs.length === 0 ? "" : ` implements ${typeRefs.join(", ")}`;
    const members = renderClassMembers(context, klass, callables, parentExpression !== undefined);
    const body = indentMembers(members);
    context.module.appendDeclaration(`export class ${className}${extendsClause}${implementsClause} {\n${body}\n}`);
    context.module.appendDeclaration(renderConstructorPropsInterface(context, klass, className));
    for (const declaration of renderSignalDeclarations(context, klass, className, false)) {
        context.module.appendDeclaration(declaration);
    }
    if (typeRefs.length > 0) {
        context.module.appendDeclaration(`export interface ${className} extends ${typeRefs.join(", ")} {}`);
    }

    appendInstallMixins(context, className, implemented);
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
    for (const property of klass.properties) {
        const block = renderPropertyAccessor({ context, property, claimedNames, methodByName });
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

const appendInstallMixins = (context: ModuleContext, className: string, implemented: ImplementedRef[]): void => {
    if (implemented.length === 0) return;
    context.addRuntimeImport("installMixins");
    const makers = implemented.map((ref) => ref.makerRef).join(", ");
    context.module.appendRegistration(`installMixins(${className}, [${makers}]);`);
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

const resolveImplementedRefs = (context: ModuleContext, klass: GirClass): ImplementedRef[] => {
    const refs: ImplementedRef[] = [];
    for (const name of klass.implements) {
        const resolved = context.repository.resolveType(context.namespace.name, name);
        if (resolved === undefined || resolved.kind !== "interface") continue;
        const pascal = toPascalCase(resolved.value.name);
        refs.push({
            typeRef: context.qualify(resolved.namespace.name, pascal),
            makerRef: context.qualify(resolved.namespace.name, `make${pascal}`),
        });
    }
    return refs;
};

const resolveParent = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.parent === undefined) return undefined;
    const [namespace, typeName] = splitOptionalNamespace(klass.parent);
    return context.qualify(namespace ?? context.namespace.name, toPascalCase(typeName));
};
