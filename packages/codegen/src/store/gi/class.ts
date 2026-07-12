import { toCamelIdentifier, toPascalCase } from "@gtkx/utils";
import {
    collectInheritedMethods,
    collectInheritedPropertyTypes,
    collectInterfaceMergeOmissions,
    conflictRename,
    type InheritedMethods,
} from "../../analysis/inheritance.js";
import { ancestorChain } from "../../gir/ancestry.js";
import type { GirClass } from "../../gir/class.js";
import type { GirFunction } from "../../gir/function.js";
import { splitOptionalNamespace } from "../../gir/type-ref.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";
import { indentMembers } from "../../writer/emit.js";
import {
    type Callables,
    classConstructorMemberNames,
    dedupeCallables,
    generateBindings,
    indexMethodsByName,
    renderClassInstanceMember,
    renderStaticHead,
} from "./callables.js";
import { renderClassConstructor, renderConstructorPropsInterface } from "./constructor-props.js";
import { gtypeExprFor, gtypeMemberDeclaration } from "./gtype-binding.js";
import { methodExportName } from "./method.js";
import { renderPropertyAccessor } from "./property-accessor.js";
import { appendWrapperClassRegistration } from "./registration.js";
import { renderSignalDeclarations, renderSignalMembers } from "./signal.js";
import { renderVfuncMetadata } from "./vtable.js";

type ImplementedRef = {
    typeRef: string;
    makerRef: string;
    interfaceKlass: GirClass;
    interfaceNamespace: string;
};

export const generateClass = (context: ModuleContext, klass: GirClass): void => {
    if (!klass.introspectable) return;
    if (klass.name.length === 0) return;
    const className = toPascalCase(klass.name);
    const callables: Callables = {
        constructors: dedupeCallables(klass.constructors),
        functions: dedupeCallables(klass.functions),
        methods: dedupeCallables(klass.methods),
    };
    generateBindings(context, callables);

    const parentExpression = resolveParent(context, klass);
    const extendsClause = renderExtendsClause(context, parentExpression, callables);
    const implemented = resolveImplementedRefs(context, klass);
    const typeRefs = implemented.map((ref) => ref.typeRef);
    const implementsClause = typeRefs.length === 0 ? "" : ` implements ${typeRefs.join(", ")}`;
    const members = renderClassMembers(context, klass, callables, parentExpression !== undefined);
    const body = indentMembers(members);
    context.module.appendDeclaration(
        `${renderJsDoc(klass.doc)}export class ${className}${extendsClause}${implementsClause} {\n${body}\n}`,
    );
    context.module.appendDeclaration(renderConstructorPropsInterface(context, klass, className));
    for (const declaration of renderSignalDeclarations(context, klass, className, false)) {
        context.module.appendDeclaration(declaration);
    }
    if (typeRefs.length > 0) {
        const mergeRefs = implemented.map((ref) => interfaceMergeRef(context, klass, ref));
        context.module.appendDeclaration(`export interface ${className} extends ${mergeRefs.join(", ")} {}`);
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
    const inheritedPropertyTypes = collectInheritedPropertyTypes(context, klass);
    for (const property of klass.properties) {
        const inheritedType = inheritedPropertyTypes.get(toCamelIdentifier(property.name));
        const block = renderPropertyAccessor({ context, property, claimedNames, methodByName, inheritedType });
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

const inheritedInterfaceKeys = (context: ModuleContext, klass: GirClass): Set<string> => {
    const keys = new Set<string>();
    if (klass.parent === undefined) return keys;
    const parent = context.library.resolveType(context.namespace.name, klass.parent);
    if (parent === undefined || parent.kind !== "class") return keys;
    for (const ancestor of ancestorChain(context.library, parent.value, parent.namespace.name)) {
        for (const name of ancestor.klass.implements) {
            const resolved = context.library.resolveType(ancestor.namespaceName, name);
            if (resolved?.kind === "interface") keys.add(`${resolved.namespace.name}.${resolved.value.name}`);
        }
    }
    return keys;
};

const interfaceMergeRef = (context: ModuleContext, klass: GirClass, ref: ImplementedRef): string => {
    const omissions = collectInterfaceMergeOmissions(context, klass, {
        klass: ref.interfaceKlass,
        namespaceName: ref.interfaceNamespace,
    });
    if (omissions.length === 0) return ref.typeRef;
    const keys = omissions.map((name) => JSON.stringify(name)).join(" | ");
    return `Omit<${ref.typeRef}, ${keys}>`;
};

const resolveImplementedRefs = (context: ModuleContext, klass: GirClass): ImplementedRef[] => {
    const inherited = inheritedInterfaceKeys(context, klass);
    const refs: ImplementedRef[] = [];
    for (const name of klass.implements) {
        const resolved = context.library.resolveType(context.namespace.name, name);
        if (resolved === undefined || resolved.kind !== "interface") continue;
        if (inherited.has(`${resolved.namespace.name}.${resolved.value.name}`)) continue;
        const pascal = toPascalCase(resolved.value.name);
        refs.push({
            typeRef: context.qualify(resolved.namespace.name, pascal),
            makerRef: context.qualify(resolved.namespace.name, `make${pascal}`),
            interfaceKlass: resolved.value,
            interfaceNamespace: resolved.namespace.name,
        });
    }
    return refs;
};

const renderExtendsClause = (
    context: ModuleContext,
    parentExpression: string | undefined,
    callables: Callables,
): string => {
    if (parentExpression === undefined) return "";
    const constructorNames = classConstructorMemberNames(context, callables);
    if (constructorNames.length === 0) return ` extends ${parentExpression}`;
    context.addRuntimeTypeImport("StaticBase");
    const omitted = constructorNames.map((name) => JSON.stringify(name)).join(" | ");
    return ` extends (${parentExpression} as StaticBase<typeof ${parentExpression}, ${omitted}>)`;
};

const resolveParent = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.parent === undefined) return undefined;
    const [namespace, typeName] = splitOptionalNamespace(klass.parent);
    return context.qualify(namespace ?? context.namespace.name, toPascalCase(typeName));
};
