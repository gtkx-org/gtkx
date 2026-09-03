import { sanitizeTypeIdentifier, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import {
    ancestorClassMethodNames,
    collectInheritedMethods,
    collectInheritedPropertyTypes,
    collectInterfaceMergeOmissions,
    hasNaturalClassChainMember,
    naturalSignalMemberNames,
    shadowedInstanceMemberName,
} from "../../analysis/inheritance.js";
import {
    areCallablesAssignable,
    type ClaimedMembers,
    claimInterfaceMembers,
    inheritedMembers,
    interfaceConflicts,
    omittedKeys,
    omittedTypeRef,
} from "../../analysis/interface-conflicts.js";
import { ancestorChain, getParentRef, type ResolvedAncestor } from "../../gir/ancestry.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { declaredFunctionName } from "../../gir/function.js";
import { indentMembers } from "../../writer/emit.js";
import {
    type Callables,
    constructorMemberName,
    dedupeCallables,
    generateBindings,
    type InstanceScope,
    instanceScope,
    renderClassInstanceMember,
    renderInstanceMethodOverload,
    renderStaticHead,
    staticMembers,
} from "./callables.js";
import { isFundamentalClass, renderClassConstructor, renderConstructorPropsInterface } from "./constructor-props.js";
import { getDoc } from "./doc-spec.js";
import { declareFoldedClass, localClassName } from "./folded.js";
import { gtypeMemberDeclaration, renderSourceGtype } from "./gtype-binding.js";
import { memberName, methodExportName } from "./method.js";
import { renderPropertyDeclarations } from "./properties.js";
import { renderResolvedPropertyAccessor, resolveAccessor } from "./property-accessor.js";
import { appendWrapperClassRegistration } from "./registration.js";
import { renderSignalDeclarations, renderSignalMembers, renderSignalRegistration } from "./signal.js";
import { renderVfuncMembers, renderVfuncMetadata } from "./vtable.js";

type ImplementedRef = {
    typeRef: string;
    makerRef: string;
    interfaceKlass: GirClass;
    interfaceNamespace: string;
    conflicts: string[];
    signalMembers: string[];
};

type MemberDeclarationsOptions = {
    context: ModuleContext;
    klass: GirClass;
    className: string;
    implemented: ImplementedRef[];
};

type ClassMembers = { members: string[] };

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
    members: string[];
    claimedNames: Set<string>;
    collisions: Set<string>;
};

type RenderInstanceMethodOptions = {
    context: ModuleContext;
    callable: GirFunction;
    scope: InstanceScope;
    collisions: Set<string>;
};

type ClassDeclarationOptions = {
    klass: GirClass;
    className: string;
    heritage: string;
    body: string;
    implemented: ImplementedRef[];
};

type MixinRegistrationOptions = {
    context: ModuleContext;
    targetName: string;
    runtimeName: "installInterfaces" | "installMixins";
    refs: string[];
    overrides: string[];
};

const SIGNAL_MEMBER_NAMES = ["connect", "disconnect", "emit", "off", "on", "once"];

type ExtendsClauseOptions = {
    context: ModuleContext;
    parentExpression: string | undefined;
    klass: GirClass;
    callables: Callables;
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
    const implemented = resolveImplementedRefs(context, klass);
    const extendsClause = renderExtendsClause({ context, parentExpression, klass, callables });
    const implementsClause = renderImplementsClause(implemented);
    const { members } = renderClassMembers(context, klass, callables, parentExpression !== undefined);
    const body = indentMembers(members);
    const heritage = `${extendsClause}${implementsClause}`;
    declareClass(context, { klass, className, heritage, body, implemented });

    context.declare({
        name: `${className}ConstructorProps`,
        code: renderConstructorPropsInterface(context, klass, className),
    });

    appendMemberDeclarations({ context, klass, className, implemented });
};

const classModifier = (context: ModuleContext, klass: GirClass): string =>
    klass.isAbstract || isFundamentalClass(context, klass) ? "abstract " : "";

const renderImplementsClause = (implemented: ImplementedRef[]): string => {
    const typeRefs = implemented.map((ref) => omittedTypeRef(ref.typeRef, ref.conflicts));

    return typeRefs.length === 0 ? "" : ` implements ${typeRefs.join(", ")}`;
};

const declareClass = (context: ModuleContext, options: ClassDeclarationOptions): void => {
    const { klass, className, heritage, body, implemented } = options;
    const localName = localClassName(className);
    appendInstallMixins(context, localName, implemented);
    appendClassRegistrations(context, klass, localName);
    const signalRegistration = renderSignalRegistration(context, klass, localName);

    if (signalRegistration !== undefined) {
        context.collectRegistration(signalRegistration);
    }

    const registrations = context.takeRegistrations();

    declareFoldedClass({
        context,
        className,
        doc: getDoc(klass),
        owner: klass.name,
        localDeclaration: `${classModifier(context, klass)}class ${localName}${heritage} {\n${body}\n}`,
        registrations,
        hasInstanceInterface: true,
    });
};

const appendMemberDeclarations = (options: MemberDeclarationsOptions): void => {
    const { context, klass, className, implemented } = options;

    for (const declaration of renderPropertyDeclarations(context, klass, className)) {
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

const instanceMethodCollisions = (
    context: ModuleContext,
    klass: GirClass,
    methods: GirFunction[],
): Set<string> => {
    const inheritedMethods = collectInheritedMethods(context, klass);

    return new Set(
        methods
            .map((callable) => shadowedInstanceMemberName(context, callable, inheritedMethods))
            .filter((name): name is string => name !== undefined),
    );
};

const renderClassMembers = (
    context: ModuleContext,
    klass: GirClass,
    callables: Callables,
    hasParent: boolean,
): ClassMembers => {
    const className = sanitizeTypeIdentifier(klass.name);
    const members: string[] = [gtypeMemberDeclaration(context)];
    const constructorBlock = renderClassConstructor(context, { klass, className, hasParent, callables });

    if (constructorBlock !== undefined) {
        members.push(constructorBlock);
    }

    const claimedNames: Set<string> = new Set();
    members.push(...renderStaticHead(context, callables, className));
    const scope = instanceScope(className, callables);
    const collisions = instanceMethodCollisions(context, klass, callables.methods);

    appendInstanceMethods({
        context,
        methods: callables.methods,
        scope,
        members,
        claimedNames,
        collisions,
    });

    members.push(...renderVfuncMembers({ context, klass, mode: "implementation" }));
    const inheritedPropertyTypes = collectInheritedPropertyTypes(context, klass);
    const inheritedNames = ancestorClassMethodNames(context, klass);
    for (const property of klass.properties) {
        const inheritedTypes = inheritedPropertyTypes.get(toCamelIdentifier(property.name));

        const accessor = resolveAccessor({
            context,
            property,
            claimedNames,
            inheritedTypes,
            inheritedNames,
        });

        if (accessor === undefined) {
            continue;
        }

        members.push(renderResolvedPropertyAccessor(context, property, accessor));
    }

    members.push(...renderSignalMembers(context, klass));

    return { members };
};

const renderInstanceMethodBlock = (options: RenderInstanceMethodOptions): string | undefined => {
    const { context, callable, scope, collisions } = options;
    const block = renderClassInstanceMember(context, callable, scope);

    if (block === undefined || !collisions.has(methodExportName(callable))) {
        return block;
    }

    const name = methodExportName(callable);
    const overload = renderInstanceMethodOverload(context, callable, scope);

    return overload === undefined ? block : `${name}(this: never, ...args: never[]): any;\n${overload}\n${block}`;
};

const appendInstanceMethods = (options: AppendInstanceMethodsOptions): void => {
    const { context, methods, scope, members, claimedNames, collisions } = options;

    for (const callable of methods) {
        const block = renderInstanceMethodBlock({ context, callable, scope, collisions });

        if (block === undefined) {
            continue;
        }

        const name = methodExportName(callable);
        members.push(block);
        claimedNames.add(name);
    }
};

const appendMixinRegistration = (options: MixinRegistrationOptions): void => {
    const { context, targetName, runtimeName, refs, overrides } = options;

    if (refs.length === 0) {
        return;
    }

    context.addRuntimeImport(runtimeName);
    const overrideArg = overrides.length === 0
        ? ""
        : `, [${overrides.map((name) => JSON.stringify(name)).join(", ")}]`;
    context.collectRegistration(`${runtimeName}(${targetName}, [${refs.join(", ")}]${overrideArg});`);
};

const appendInstallMixins = (context: ModuleContext, targetName: string, implemented: ImplementedRef[]): void => {
    const registered = implemented.filter((ref) => ref.interfaceKlass.glibGetType !== undefined);
    const unregistered = implemented.filter((ref) => ref.interfaceKlass.glibGetType === undefined);

    appendMixinRegistration({
        context,
        targetName,
        runtimeName: "installInterfaces",
        refs: registered.map((ref) => ref.typeRef),
        overrides: [...new Set(registered.flatMap((ref) => ref.signalMembers))],
    });
    appendMixinRegistration({
        context,
        targetName,
        runtimeName: "installMixins",
        refs: unregistered.map((ref) => ref.makerRef),
        overrides: [...new Set(unregistered.flatMap((ref) => ref.signalMembers))],
    });
};

const appendClassRegistrations = (context: ModuleContext, klass: GirClass, targetName: string): void => {
    const gtypeExpr = renderSourceGtype(context, klass);

    appendWrapperClassRegistration(context, {
        className: targetName,
        gtypeExpr,
        vfuncs: renderVfuncMetadata(context, klass),
    });

    appendClassStructRegistration(context, klass, targetName, gtypeExpr);
};

const appendClassStructRegistration = (
    context: ModuleContext,
    klass: GirClass,
    targetName: string,
    gtypeExpr: string | undefined,
): void => {
    const typeStruct = klass.glibTypeStruct;

    if (gtypeExpr === undefined || typeStruct === undefined) {
        return;
    }

    const resolved = context.library.resolveType(context.namespace.name, typeStruct);

    if (resolved?.kind !== "record" || !isEmittableEntity(resolved.value)) {
        return;
    }

    const structName = sanitizeTypeIdentifier(resolved.value.name);
    context.addRuntimeImport("registerClassStruct");
    context.collectRegistration(`registerClassStruct(${targetName}, ${structName});`);
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

    const classSignalMembers = SIGNAL_MEMBER_NAMES.filter((member) =>
        hasNaturalClassChainMember(context, klass, member),
    );
    const conflicts = [...new Set([...interfaceConflicts(conflictOptions, options.claimed), ...classSignalMembers])];
    claimInterfaceMembers(conflictOptions, options.claimed);

    return {
        typeRef: context.qualify(resolved.namespace.name, typeName),
        makerRef: context.qualify(resolved.namespace.name, `make${typeName}`),
        interfaceKlass: resolved.value,
        interfaceNamespace: resolved.namespace.name,
        conflicts,
        signalMembers: naturalSignalMemberNames(context, resolved.value).filter(
            (member) => !hasNaturalClassChainMember(context, klass, member),
        ),
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

const classCallables = (klass: GirClass): Callables => ({
    constructors: klass.constructors,
    functions: klass.functions,
    methods: klass.methods,
});

const resolveParentClass = (context: ModuleContext, klass: GirClass): ResolvedAncestor | undefined => {
    const parent = getParentRef(klass);

    if (parent === undefined) {
        return undefined;
    }

    const resolved = context.library.resolveType(parent.namespaceName ?? context.namespace.name, parent.typeName);

    return resolved?.kind === "class"
        ? { klass: resolved.value, namespace: resolved.namespace, namespaceName: resolved.namespace.name }
        : undefined;
};

const addAncestorStatics = (context: ModuleContext, klass: GirClass, table: Map<string, GirFunction>): void => {
    const members = staticMembers(context, classCallables(klass));

    for (const member of members) {
        if (!table.has(member.name)) {
            table.set(member.name, member.callable);
        }
    }
};

const inheritedStatics = (context: ModuleContext, klass: GirClass): Map<string, GirFunction> => {
    const table: Map<string, GirFunction> = new Map();
    const parent = resolveParentClass(context, klass);

    if (parent === undefined) {
        return table;
    }

    for (const ancestor of ancestorChain(context.library, parent.klass, parent.namespaceName)) {
        addAncestorStatics(context, ancestor.klass, table);
    }

    return table;
};

const shadowedStaticNames = (context: ModuleContext, klass: GirClass, callables: Callables): string[] => {
    const inherited = inheritedStatics(context, klass);

    const conflicts = staticMembers(context, callables)
        .filter((member) => {
            const shadowed = inherited.get(member.name);

            return shadowed !== undefined && !areCallablesAssignable(context.library, member.callable, shadowed);
        })
        .map((member) => member.name);

    const constructorAliases = callables.constructors
        .filter((callable) => declaredFunctionName(callable) !== callable.name)
        .map((callable) => constructorMemberName(declaredFunctionName(callable)))
        .filter((name): name is string => name !== undefined);

    const functionAliases = callables.functions
        .filter((callable) => declaredFunctionName(callable) !== callable.name)
        .map((callable) => memberName(declaredFunctionName(callable)));

    return [...new Set([...conflicts, ...constructorAliases, ...functionAliases])];
};

const renderExtendsClause = (options: ExtendsClauseOptions): string => {
    const { context, parentExpression, klass, callables } = options;

    if (parentExpression === undefined) {
        return "";
    }

    const staticNames = shadowedStaticNames(context, klass, callables);

    if (staticNames.length === 0) {
        return ` extends ${parentExpression}`;
    }

    let baseType = `typeof ${parentExpression}`;

    context.addRuntimeTypeImport("StaticBase");
    baseType = `StaticBase<${baseType}, ${omittedKeys(staticNames)}>`;

    return ` extends (${parentExpression} as ${baseType})`;
};

const resolveParent = (context: ModuleContext, klass: GirClass): string | undefined => {
    const parent = getParentRef(klass);

    if (parent === undefined) {
        return undefined;
    }

    const qualified = context.qualify(
        parent.namespaceName ?? context.namespace.name,
        sanitizeTypeIdentifier(parent.typeName),
    );

    return context.hoistBaseRef(qualified);
};

export { generateClass };
