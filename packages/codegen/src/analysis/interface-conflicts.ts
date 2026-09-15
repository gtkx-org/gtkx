import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { GirParameter } from "../gir/parameter.js";
import type { ModuleContext } from "../writer/context.js";
import { resolveClassOrInterface, type ResolvedAncestor, resolveInterfaces } from "../gir/ancestry.js";
import {
    type InstanceScope,
    instanceScope,
    isEmittableCallable,
    renderInstanceMethodReturnType,
} from "../store/gi/callables.js";
import { memberName } from "../store/gi/method.js";
import { protectedChainSlotKeys, vfuncCallables, vfuncMemberNames } from "../store/gi/vtable.js";
import { comparisonContextFor } from "../writer/comparison-context.js";
import { collectInheritedMethods } from "./inheritance.js";
import { inputParameters } from "./param-structure.js";
import { typeKey } from "./type-key.js";

type Member = { callable: GirFunction } & ({ scope: InstanceScope } | { returnType: string });
type MemberTable = Map<string, Member>;

type ClaimedMembers = {
    inherited: MemberTable;
    interfaces: MemberTable;
};

type InterfaceConflictOptions = {
    context: ModuleContext;
    klass: GirClass;
    iface: GirClass;
    ifaceNamespace: string;
};

type CallableKeys = {
    inputs: string[];
    output: string;
};

type CallableKeyPair = {
    own: CallableKeys;
    other: CallableKeys;
};

const CHAINABLE_SIGNAL_MEMBERS = ["off", "on", "once"];
const SYNTHETIC_SIGNAL_MEMBERS = new Set(["connect", "disconnect", "emit", ...CHAINABLE_SIGNAL_MEMBERS]);

const valueKey = (library: Library, value: GirParameter): string =>
    `${typeKey(library, value.type)}${value.nullable ? " | null" : ""}`;

const callableKeys = (context: ModuleContext, member: Member): CallableKeys => ({
    inputs: inputParameters(context.library, member.callable).map(({ parameter }) =>
        `${valueKey(context.library, parameter)}${parameter.optional ? " | undefined" : ""}`,
    ),
    output: "returnType" in member
        ? member.returnType
        : renderInstanceMethodReturnType(comparisonContextFor(context), member.callable, member.scope),
});

const areKeysEqual = (left: string[], right: string[]): boolean =>
    left.length === right.length && left.every((key, index) => key === right[index]);

const callableKeyPair = (context: ModuleContext, own: Member, other: Member): CallableKeyPair => ({
    own: callableKeys(context, own),
    other: callableKeys(context, other),
});

const areCallablesIdentical = (context: ModuleContext, own: Member, other: Member): boolean => {
    const keys = callableKeyPair(context, own, other);

    return areKeysEqual(keys.own.inputs, keys.other.inputs) && keys.own.output === keys.other.output;
};

const areCallablesAssignable = (context: ModuleContext, own: Member, other: Member): boolean => {
    const keys = callableKeyPair(context, own, other);

    if (keys.own.inputs.length > keys.other.inputs.length) {
        return false;
    }

    if (keys.own.inputs.some((key, index) => key !== keys.other.inputs[index])) {
        return false;
    }

    return keys.other.output === "void" || keys.own.output === keys.other.output;
};

const collectMethods = (context: ModuleContext, klass: GirClass, members: MemberTable): void => {
    const scope = instanceScope(klass.name, klass);

    for (const method of klass.methods) {
        const name = memberName(method.name);

        if (isEmittableCallable(context, method) && !members.has(name)) {
            members.set(name, { callable: method, scope });
        }
    }
};

const inheritedMembers = (context: ModuleContext, klass: GirClass): ClaimedMembers => {
    const inherited: MemberTable = new Map();
    collectMethods(context, klass, inherited);

    for (const [name, member] of collectInheritedMethods(context, klass)) {
        if (!inherited.has(name)) {
            inherited.set(name, { callable: member.method, returnType: member.returnType });
        }
    }

    return { inherited, interfaces: new Map() };
};

const interfaceMembers = (options: InterfaceConflictOptions): MemberTable => {
    const members: MemberTable = new Map();
    collectMethods(options.context, options.iface, members);
    const prerequisites = interfaceSupertypes(options.context.library, {
        klass: options.iface,
        namespaceName: options.ifaceNamespace,
    });
    const visited: Set<string> = new Set();

    for (const prerequisite of prerequisites) {
        collectSupertypeMembers(options.context, prerequisite, visited, members);
    }

    const scratch = comparisonContextFor(options.context);

    for (const [key, member] of vfuncCallables(scratch, options.ifaceNamespace, options.iface)) {
        members.set(key, member);
    }

    return members;
};

const claimInterfaceMembers = (options: InterfaceConflictOptions, claimed: ClaimedMembers): void => {
    for (const [key, callable] of interfaceMembers(options)) {
        if (!claimed.interfaces.has(key)) {
            claimed.interfaces.set(key, callable);
        }
    }
};

const isConflictingMember = (
    context: ModuleContext,
    claimed: ClaimedMembers,
    entry: [string, Member],
): boolean => {
    const [name, method] = entry;
    const owned = claimed.inherited.get(name);

    if (owned !== undefined) {
        return !areCallablesIdentical(context, owned, method);
    }

    const sibling = claimed.interfaces.get(name);

    return sibling !== undefined && !areCallablesIdentical(context, sibling, method);
};

const conflictingMemberNames = (options: InterfaceConflictOptions, claimed: ClaimedMembers): string[] =>
    [...interfaceMembers(options)]
        .filter((entry) => isConflictingMember(options.context, claimed, entry))
        .map(([name]) => name);

const protectedVfuncNames = (options: InterfaceConflictOptions): string[] => {
    const { context, klass, iface, ifaceNamespace } = options;
    const protectedKeys = protectedChainSlotKeys(context, klass);

    return vfuncMemberNames(context, ifaceNamespace, iface).filter((key) => protectedKeys.has(key));
};

const interfaceConflicts = (options: InterfaceConflictOptions, claimed: ClaimedMembers): string[] => {
    const names = [...conflictingMemberNames(options, claimed), ...protectedVfuncNames(options)];

    return names.length === 0 ? names : [...new Set([...names, ...CHAINABLE_SIGNAL_MEMBERS])];
};

const rootPrerequisite = (library: Library): ResolvedAncestor[] => {
    const root = resolveClassOrInterface(library, "GObject", "Object");

    return root === undefined ? [] : [root];
};

const interfaceSupertypes = (
    library: Library,
    entry: Pick<ResolvedAncestor, "klass" | "namespaceName">,
): ResolvedAncestor[] => {
    const prerequisites = entry.klass.prerequisites
        .map((name) => resolveClassOrInterface(library, entry.namespaceName, name))
        .filter((prerequisite) => prerequisite !== undefined);

    return prerequisites.length === 0 ? rootPrerequisite(library) : prerequisites;
};

const classSupertypes = (library: Library, entry: ResolvedAncestor): ResolvedAncestor[] => {
    const interfaces = resolveInterfaces(library, entry.namespaceName, entry.klass.implements);

    if (entry.klass.parent === undefined) {
        return interfaces;
    }

    const parent = resolveClassOrInterface(library, entry.namespaceName, entry.klass.parent);

    return parent === undefined ? interfaces : [parent, ...interfaces];
};

const directSupertypes = (library: Library, entry: ResolvedAncestor): ResolvedAncestor[] =>
    entry.klass.isInterface ? interfaceSupertypes(library, entry) : classSupertypes(library, entry);

const collectSupertypeMembers = (
    context: ModuleContext,
    entry: ResolvedAncestor,
    visited: Set<string>,
    members: MemberTable,
): void => {
    const key = `${entry.namespaceName}.${entry.klass.name}`;

    if (visited.has(key)) {
        return;
    }

    visited.add(key);
    collectMethods(context, entry.klass, members);

    for (const supertype of directSupertypes(context.library, entry)) {
        collectSupertypeMembers(context, supertype, visited, members);
    }
};

const supertypeMembers = (context: ModuleContext, base: ResolvedAncestor): MemberTable => {
    const members: MemberTable = new Map();
    collectSupertypeMembers(context, base, new Set(), members);

    return members;
};

const isPrerequisiteConflict = (
    context: ModuleContext,
    inherited: MemberTable,
    entry: [string, Member],
): boolean => {
    const [name, method] = entry;
    const owned = inherited.get(name);

    return SYNTHETIC_SIGNAL_MEMBERS.has(name) ||
        (owned !== undefined && !areCallablesAssignable(context, method, owned));
};

const prerequisiteConflicts = (context: ModuleContext, iface: GirClass, base: ResolvedAncestor): string[] => {
    const members: MemberTable = new Map();
    collectMethods(context, iface, members);
    const inherited = supertypeMembers(context, base);

    return [...members]
        .filter((entry) => isPrerequisiteConflict(context, inherited, entry))
        .map(([name]) => name);
};

const omittedKeys = (omissions: string[]): string =>
    [...new Set(omissions)].map((name) => JSON.stringify(name)).join(" | ");

const omittedTypeRef = (typeRef: string, omissions: string[]): string =>
    omissions.length === 0 ? typeRef : `Omit<${typeRef}, ${omittedKeys(omissions)}>`;

export {
    type ClaimedMembers,
    claimInterfaceMembers,
    inheritedMembers,
    interfaceConflicts,
    omittedKeys,
    omittedTypeRef,
    prerequisiteConflicts,
};
