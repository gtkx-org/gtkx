import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { ModuleContext } from "../writer/context.js";
import { resolveClassOrInterface, type ResolvedAncestor, resolveInterfaces } from "../gir/ancestry.js";
import { isOutParameter } from "../gir/parameter.js";
import { memberName } from "../store/gi/method.js";
import { protectedChainSlotKeys, vfuncCallables, vfuncMemberNames } from "../store/gi/vtable.js";
import { forEachAncestor } from "./inheritance.js";
import { inputParameters } from "./param-structure.js";
import { typeKey } from "./type-key.js";

type MemberTable = Map<string, GirFunction>;

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
    outputs: string[];
};

type CallableKeyPair = {
    own: CallableKeys;
    other: CallableKeys;
};

const CHAINABLE_SIGNAL_MEMBERS = ["addEventListener", "off", "on", "once", "removeEventListener"];

const callableKeys = (library: Library, fn: GirFunction): CallableKeys => ({
    inputs: inputParameters(library, fn).map((entry) => typeKey(library, entry.parameter.type)),
    outputs: [
        typeKey(library, fn.returnValue.type),
        ...fn.parameters
            .filter((parameter) => isOutParameter(parameter))
            .map((parameter) => typeKey(library, parameter.type)),
    ],
});

const areKeysEqual = (left: string[], right: string[]): boolean =>
    left.length === right.length && left.every((key, index) => key === right[index]);

const callableKeyPair = (library: Library, own: GirFunction, other: GirFunction): CallableKeyPair => ({
    own: callableKeys(library, own),
    other: callableKeys(library, other),
});

const areCallablesIdentical = (library: Library, own: GirFunction, other: GirFunction): boolean => {
    const keys = callableKeyPair(library, own, other);

    return areKeysEqual(keys.own.inputs, keys.other.inputs) && areKeysEqual(keys.own.outputs, keys.other.outputs);
};

const areCallablesAssignable = (library: Library, own: GirFunction, other: GirFunction): boolean => {
    const keys = callableKeyPair(library, own, other);

    if (keys.own.inputs.length > keys.other.inputs.length) {
        return false;
    }

    if (keys.own.inputs.some((key, index) => key !== keys.other.inputs[index])) {
        return false;
    }

    return areKeysEqual(keys.other.outputs, ["void"]) || areKeysEqual(keys.own.outputs, keys.other.outputs);
};

const collectMethods = (klass: GirClass, members: MemberTable): void => {
    for (const method of klass.methods) {
        const name = memberName(method.name);

        if (method.introspectable && !members.has(name)) {
            members.set(name, method);
        }
    }
};

const inheritedMembers = (context: ModuleContext, klass: GirClass): ClaimedMembers => {
    const inherited: MemberTable = new Map();

    forEachAncestor(context, klass, (ancestor) => {
        collectMethods(ancestor.klass, inherited);
    });

    return { inherited, interfaces: new Map() };
};

const interfaceMembers = (options: InterfaceConflictOptions): MemberTable => {
    const members: MemberTable = new Map();
    collectMethods(options.iface, members);

    for (const [key, callable] of vfuncCallables(options.context, options.ifaceNamespace, options.iface)) {
        members.set(key, callable);
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

const isConflictingMember = (library: Library, claimed: ClaimedMembers, entry: [string, GirFunction]): boolean => {
    const [name, method] = entry;
    const owned = claimed.inherited.get(name);

    if (owned !== undefined) {
        return !areCallablesAssignable(library, owned, method);
    }

    const sibling = claimed.interfaces.get(name);

    return sibling !== undefined && !areCallablesIdentical(library, sibling, method);
};

const conflictingMemberNames = (options: InterfaceConflictOptions, claimed: ClaimedMembers): string[] =>
    [...interfaceMembers(options)]
        .filter((entry) => isConflictingMember(options.context.library, claimed, entry))
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

const interfaceSupertypes = (library: Library, entry: ResolvedAncestor): ResolvedAncestor[] => {
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
    library: Library,
    entry: ResolvedAncestor,
    visited: Set<string>,
    members: MemberTable,
): void => {
    const key = `${entry.namespaceName}.${entry.klass.name}`;

    if (visited.has(key)) {
        return;
    }

    visited.add(key);
    collectMethods(entry.klass, members);

    for (const supertype of directSupertypes(library, entry)) {
        collectSupertypeMembers(library, supertype, visited, members);
    }
};

const supertypeMembers = (library: Library, base: ResolvedAncestor): MemberTable => {
    const members: MemberTable = new Map();
    collectSupertypeMembers(library, base, new Set(), members);

    return members;
};

const prerequisiteConflicts = (library: Library, iface: GirClass, base: ResolvedAncestor): string[] => {
    const members: MemberTable = new Map();
    collectMethods(iface, members);
    const inherited = supertypeMembers(library, base);
    const names: string[] = [];

    for (const [name, method] of members) {
        const owned = inherited.get(name);

        if (owned !== undefined && !areCallablesAssignable(library, method, owned)) {
            names.push(name);
        }
    }

    return names;
};

const omittedTypeRef = (typeRef: string, omissions: string[]): string => {
    if (omissions.length === 0) {
        return typeRef;
    }

    const keys = [...new Set(omissions)].map((name) => JSON.stringify(name)).join(" | ");

    return `Omit<${typeRef}, ${keys}>`;
};

export {
    type ClaimedMembers,
    claimInterfaceMembers,
    inheritedMembers,
    interfaceConflicts,
    omittedTypeRef,
    prerequisiteConflicts,
};
