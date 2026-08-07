import { pascalCase, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import {
    collectInheritedMethods,
    collectInheritedPropertyTypes,
    collectInterfaceMergeOmissions,
    conflictRename,
    type InheritedMethods,
} from "../../analysis/inheritance.js";
import { ancestorChain, type ResolvedAncestor } from "../../gir/ancestry.js";
import { splitOptionalNamespace } from "../../gir/type-ref.js";
import { indentMembers } from "../../writer/emit.js";
import {
    type Callables,
    classConstructorMemberNames,
    dedupeCallables,
    generateBindings,
    type InstanceScope,
    instanceScope,
    renderClassInstanceMember,
    renderStaticHead,
} from "./callables.js";
import { renderClassConstructor, renderConstructorPropsInterface } from "./constructor-props.js";
import { getDoc } from "./doc-spec.js";
import { gtypeMemberDeclaration, renderSourceGtype } from "./gtype-binding.js";
import { methodExportName } from "./method.js";
import { renderPropertyDeclarations } from "./properties.js";
import { renderResolvedPropertyAccessor, resolveAccessor, type ResolvedAccessor } from "./property-accessor.js";
import { appendWrapperClassRegistration } from "./registration.js";
import { renderSignalDeclarations, renderSignalMembers } from "./signal.js";
import { renderVfuncMembers, renderVfuncMetadata } from "./vtable.js";

type ImplementedRef = {
    typeRef: string;
    makerRef: string;
    interfaceKlass: GirClass;
    interfaceNamespace: string;
};

type MemberDeclarationsOptions = {
    context: ModuleContext;
    klass: GirClass;
    className: string;
    accessors: ResolvedAccessor[];
    implemented: ImplementedRef[];
};

type ClassMembers = { members: string[]; accessors: ResolvedAccessor[] };

type AppendInstanceMethodsOptions = {
    context: ModuleContext;
    methods: GirFunction[];
    scope: InstanceScope;
    inherited: InheritedMethods;
    members: string[];
    claimedNames: Set<string>;
    className: string;
};

const generateClass = (context: ModuleContext, klass: GirClass): void => {
    if (!klass.introspectable) {
        return;
    }

    if (klass.name.length === 0) {
        return;
    }

    const className = pascalCase(klass.name);

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
    const { members, accessors } = renderClassMembers(context, klass, callables, parentExpression !== undefined);
    const body = indentMembers(members);
    const doc = getDoc(klass);

    context.module.appendDeclaration(
        `${doc}export class ${className}${extendsClause}${implementsClause} {\n${body}\n}`,
        context.declaredType(className),
    );

    context.module.appendDeclaration(renderConstructorPropsInterface(context, klass, className));
    appendMemberDeclarations({ context, klass, className, accessors, implemented });
    appendInstallMixins(context, className, implemented);
    appendClassRegistrations(context, klass, className);
};

const appendMemberDeclarations = (options: MemberDeclarationsOptions): void => {
    const { context, klass, className, accessors, implemented } = options;

    for (const declaration of renderPropertyDeclarations(context, klass, className, accessors)) {
        context.module.appendDeclaration(declaration);
    }

    for (const declaration of renderSignalDeclarations(context, klass, className, false)) {
        context.module.appendDeclaration(declaration);
    }

    appendInterfaceMerge(context, klass, className, implemented);
};

const appendInterfaceMerge = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
    implemented: ImplementedRef[],
): void => {
    if (implemented.length === 0) {
        return;
    }

    const mergeRefs = implemented.map((ref) => interfaceMergeRef(context, klass, ref));
    context.module.appendDeclaration(`export interface ${className} extends ${mergeRefs.join(", ")} {}`);
};

const renderClassMembers = (
    context: ModuleContext,
    klass: GirClass,
    callables: Callables,
    hasParent: boolean,
): ClassMembers => {
    const className = pascalCase(klass.name);
    const members: string[] = [gtypeMemberDeclaration(context)];
    const constructorBlock = renderClassConstructor(context, klass, className, hasParent);

    if (constructorBlock !== undefined) {
        members.push(constructorBlock);
    }

    const claimedNames: Set<string> = new Set();
    members.push(...renderStaticHead(context, callables, className));
    const inherited = collectInheritedMethods(context, klass);
    const scope = instanceScope(className, callables);

    appendInstanceMethods({
        context,
        methods: callables.methods,
        scope,
        inherited,
        members,
        claimedNames,
        className,
    });

    members.push(...renderVfuncMembers({ context, klass, mode: "implementation" }));
    const inheritedPropertyTypes = collectInheritedPropertyTypes(context, klass);
    const accessors: ResolvedAccessor[] = [];

    for (const property of klass.properties) {
        const inheritedType = inheritedPropertyTypes.get(toCamelIdentifier(property.name));

        const accessor = resolveAccessor({
            context,
            property,
            claimedNames,
            methodByName: scope.methodByName,
            inheritedType,
        });

        if (accessor === undefined) {
            continue;
        }

        accessors.push(accessor);
        members.push(renderResolvedPropertyAccessor(context, property, accessor));
    }

    members.push(...renderSignalMembers(context, klass));

    return { members, accessors };
};

const appendInstanceMethods = (options: AppendInstanceMethodsOptions): void => {
    const { context, methods, scope, inherited, members, claimedNames, className } = options;

    for (const callable of methods) {
        const rename = conflictRename(context, callable, inherited, className);
        const block = renderClassInstanceMember(context, callable, scope, rename);

        if (block === undefined) {
            continue;
        }

        members.push(block);
        claimedNames.add(rename ?? methodExportName(callable));
    }
};

const appendInstallMixins = (context: ModuleContext, className: string, implemented: ImplementedRef[]): void => {
    if (implemented.length === 0) {
        return;
    }

    context.addRuntimeImport("installMixins");
    const makers = implemented.map((ref) => ref.makerRef).join(", ");
    context.module.appendRegistration(`installMixins(${className}, [${makers}]);`);
};

const appendClassRegistrations = (context: ModuleContext, klass: GirClass, className: string): void => {
    const gtypeExpr = renderSourceGtype(context, klass);

    appendWrapperClassRegistration(context, {
        className,
        gtypeExpr,
        vfuncs: renderVfuncMetadata(context, klass),
    });
};

const addAncestorInterfaceKeys = (context: ModuleContext, ancestor: ResolvedAncestor, keys: Set<string>): void => {
    for (const name of ancestor.klass.implements) {
        const resolved = context.library.resolveType(ancestor.namespaceName, name);

        if (resolved?.kind === "interface") {
            keys.add(`${resolved.namespace.name}.${resolved.value.name}`);
        }
    }
};

const inheritedInterfaceKeys = (context: ModuleContext, klass: GirClass): Set<string> => {
    const keys: Set<string> = new Set();

    if (klass.parent === undefined) {
        return keys;
    }

    const parent = context.library.resolveType(context.namespace.name, klass.parent);

    if (parent?.kind !== "class") {
        return keys;
    }

    for (const ancestor of ancestorChain(context.library, parent.value, parent.namespace.name)) {
        addAncestorInterfaceKeys(context, ancestor, keys);
    }

    return keys;
};

const interfaceMergeRef = (context: ModuleContext, klass: GirClass, ref: ImplementedRef): string => {
    const omissions = collectInterfaceMergeOmissions(context, klass, {
        klass: ref.interfaceKlass,
        namespaceName: ref.interfaceNamespace,
    });

    if (omissions.length === 0) {
        return ref.typeRef;
    }

    const keys = omissions.map((name) => JSON.stringify(name)).join(" | ");

    return `Omit<${ref.typeRef}, ${keys}>`;
};

const implementedRefFor = (
    context: ModuleContext,
    name: string,
    inherited: Set<string>,
): ImplementedRef | undefined => {
    const resolved = context.library.resolveType(context.namespace.name, name);

    if (resolved?.kind !== "interface") {
        return undefined;
    }

    if (inherited.has(`${resolved.namespace.name}.${resolved.value.name}`)) {
        return undefined;
    }

    const pascal = pascalCase(resolved.value.name);

    return {
        typeRef: context.qualify(resolved.namespace.name, pascal),
        makerRef: context.qualify(resolved.namespace.name, `make${pascal}`),
        interfaceKlass: resolved.value,
        interfaceNamespace: resolved.namespace.name,
    };
};

const resolveImplementedRefs = (context: ModuleContext, klass: GirClass): ImplementedRef[] => {
    const inherited = inheritedInterfaceKeys(context, klass);
    const refs: ImplementedRef[] = [];

    for (const name of klass.implements) {
        const ref = implementedRefFor(context, name, inherited);

        if (ref !== undefined) {
            refs.push(ref);
        }
    }

    return refs;
};

const renderExtendsClause = (
    context: ModuleContext,
    parentExpression: string | undefined,
    callables: Callables,
): string => {
    if (parentExpression === undefined) {
        return "";
    }

    const constructorNames = classConstructorMemberNames(context, callables);

    if (constructorNames.length === 0) {
        return ` extends ${parentExpression}`;
    }

    context.addRuntimeTypeImport("StaticBase");
    const omitted = constructorNames.map((name) => JSON.stringify(name)).join(" | ");

    return ` extends (${parentExpression} as StaticBase<typeof ${parentExpression}, ${omitted}>)`;
};

const resolveParent = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.parent === undefined) {
        return undefined;
    }

    const [namespace, typeName] = splitOptionalNamespace(klass.parent);

    return context.qualify(namespace ?? context.namespace.name, pascalCase(typeName));
};

export { generateClass };
