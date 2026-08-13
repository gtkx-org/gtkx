import { sanitizeTypeIdentifier, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import {
    ancestorClassMethodNames,
    collectInheritedMethods,
    collectInheritedPropertyTypes,
    collectInterfaceMergeOmissions,
    conflictRename,
    type InheritedMethods,
} from "../../analysis/inheritance.js";
import {
    type ClaimedMembers,
    claimInterfaceMembers,
    inheritedMembers,
    interfaceConflicts,
    omittedTypeRef,
} from "../../analysis/interface-conflicts.js";
import { ancestorChain, getParentRef, type ResolvedAncestor } from "../../gir/ancestry.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { indentMembers } from "../../writer/emit.js";
import {
    type Callables,
    constructorMemberNames,
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
    conflicts: string[];
};

type MemberDeclarationsOptions = {
    context: ModuleContext;
    klass: GirClass;
    className: string;
    accessors: ResolvedAccessor[];
    implemented: ImplementedRef[];
};

type ClassMembers = { members: string[]; accessors: ResolvedAccessor[] };

type ImplementedRefOptions = {
    context: ModuleContext;
    klass: GirClass;
    name: string;
    inherited: Set<string>;
    claimed: ClaimedMembers;
};

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
    if (!isEmittableEntity(klass)) {
        return;
    }

    const className = sanitizeTypeIdentifier(klass.name);

    const callables: Callables = {
        constructors: dedupeCallables(klass.constructors),
        functions: dedupeCallables(klass.functions),
        methods: dedupeCallables(klass.methods),
    };

    generateBindings(context, callables);
    const parentExpression = resolveParent(context, klass);
    const extendsClause = renderExtendsClause(context, parentExpression, callables);
    const implemented = resolveImplementedRefs(context, klass);
    const typeRefs = implemented.map((ref) => omittedTypeRef(ref.typeRef, ref.conflicts));
    const implementsClause = typeRefs.length === 0 ? "" : ` implements ${typeRefs.join(", ")}`;
    const { members, accessors } = renderClassMembers(context, klass, callables, parentExpression !== undefined);
    const body = indentMembers(members);
    const doc = getDoc(klass);
    const modifier = klass.isAbstract ? "abstract " : "";

    context.declare({
        name: className,
        code: `${doc}export ${modifier}class ${className}${extendsClause}${implementsClause} {\n${body}\n}`,
        owner: klass.name,
    });

    context.declare({
        name: `${className}ConstructorProps`,
        code: renderConstructorPropsInterface(context, klass, className),
    });

    appendMemberDeclarations({ context, klass, className, accessors, implemented });
    appendInstallMixins(context, className, implemented);
    appendClassRegistrations(context, klass, className);
};

const appendMemberDeclarations = (options: MemberDeclarationsOptions): void => {
    const { context, klass, className, accessors, implemented } = options;

    for (const declaration of renderPropertyDeclarations(context, klass, className, accessors)) {
        context.declare(declaration);
    }

    for (const declaration of renderSignalDeclarations(context, klass, className, false)) {
        context.declare(declaration);
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

    context.declare({
        name: className,
        code: `export interface ${className} extends ${mergeRefs.join(", ")} {}`,
    });
};

const renderClassMembers = (
    context: ModuleContext,
    klass: GirClass,
    callables: Callables,
    hasParent: boolean,
): ClassMembers => {
    const className = sanitizeTypeIdentifier(klass.name);
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
    const inheritedNames = ancestorClassMethodNames(context, klass);
    const accessors: ResolvedAccessor[] = [];

    for (const property of klass.properties) {
        const inheritedTypes = inheritedPropertyTypes.get(toCamelIdentifier(property.name));

        const accessor = resolveAccessor({
            context,
            property,
            claimedNames,
            methodByName: scope.methodByName,
            inheritedTypes,
            inheritedNames,
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
    const makerRefs = implemented.map((ref) => ref.makerRef);
    const localRefs = makerRefs.filter((ref) => !ref.includes("."));

    context.module.appendRegistration(`installMixins(${className}, [${makerRefs.join(", ")}]);`, [
        className,
        ...localRefs,
    ]);
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

    return omittedTypeRef(ref.typeRef, [...omissions, ...ref.conflicts]);
};

const implementedRefFor = (options: ImplementedRefOptions): ImplementedRef | undefined => {
    const { context, klass, name, inherited } = options;
    const resolved = context.library.resolveType(context.namespace.name, name);

    if (resolved?.kind !== "interface" || !isEmittableEntity(resolved.value)) {
        return undefined;
    }

    if (inherited.has(`${resolved.namespace.name}.${resolved.value.name}`)) {
        return undefined;
    }

    const typeName = sanitizeTypeIdentifier(resolved.value.name);

    const conflictOptions = {
        context,
        klass,
        iface: resolved.value,
        ifaceNamespace: resolved.namespace.name,
    };

    const conflicts = interfaceConflicts(conflictOptions, options.claimed);
    claimInterfaceMembers(conflictOptions, options.claimed);

    return {
        typeRef: context.qualify(resolved.namespace.name, typeName),
        makerRef: context.qualify(resolved.namespace.name, `make${typeName}`),
        interfaceKlass: resolved.value,
        interfaceNamespace: resolved.namespace.name,
        conflicts,
    };
};

const resolveImplementedRefs = (context: ModuleContext, klass: GirClass): ImplementedRef[] => {
    const inherited = inheritedInterfaceKeys(context, klass);
    const claimed = inheritedMembers(context, klass);
    const refs: ImplementedRef[] = [];

    for (const name of klass.implements) {
        const ref = implementedRefFor({ context, klass, name, inherited, claimed });

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

    const constructorNames = constructorMemberNames(context, callables.constructors);

    if (constructorNames.length === 0) {
        return ` extends ${parentExpression}`;
    }

    context.addRuntimeTypeImport("StaticBase");
    const omitted = constructorNames.map((name) => JSON.stringify(name)).join(" | ");

    return ` extends (${parentExpression} as StaticBase<typeof ${parentExpression}, ${omitted}>)`;
};

const resolveParent = (context: ModuleContext, klass: GirClass): string | undefined => {
    const parent = getParentRef(klass);

    return parent === undefined
        ? undefined
        : context.qualify(parent.namespaceName ?? context.namespace.name, sanitizeTypeIdentifier(parent.typeName));
};

export { generateClass };
