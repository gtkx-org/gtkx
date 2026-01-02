/**
 * Class Traversal Utilities
 *
 * Shared utilities for traversing class hierarchies.
 */

import type { GirRepository, NormalizedClass, NormalizedInterface, QualifiedName } from "@gtkx/gir";
import { toCamelCase } from "./naming.js";

/**
 * Collects interfaces implemented by all parent classes.
 */
function collectParentInterfaces(cls: NormalizedClass): Set<QualifiedName> {
    const interfaces = new Set<QualifiedName>();

    let current = cls.getParent();
    while (current) {
        for (const ifaceQName of current.implements) {
            interfaces.add(ifaceQName);
        }
        current = current.getParent();
    }

    return interfaces;
}

/**
 * Generic member collector for parent hierarchy traversal.
 * Extracts and transforms member names from classes and their interfaces.
 *
 * @param cls - The class to start from
 * @param repo - GIR repository for interface resolution
 * @param getClassMembers - Function to extract members from a class
 * @param getInterfaceMembers - Function to extract members from an interface
 * @param transformName - Optional function to transform member names (e.g., toCamelCase)
 */
function collectParentMemberNames<T extends { name: string }>(
    cls: NormalizedClass,
    repo: GirRepository,
    getClassMembers: (c: NormalizedClass) => readonly T[],
    getInterfaceMembers: (i: NormalizedInterface) => readonly T[],
    transformName: (name: string) => string = (n) => n,
): Set<string> {
    const names = new Set<string>();

    let current = cls.getParent();
    while (current) {
        for (const member of getClassMembers(current)) {
            names.add(transformName(member.name));
        }

        for (const ifaceQName of current.implements) {
            const iface = repo.resolveInterface(ifaceQName);
            if (iface) {
                for (const member of getInterfaceMembers(iface)) {
                    names.add(transformName(member.name));
                }
            }
        }

        current = current.getParent();
    }

    return names;
}

/**
 * Collects property names from all parent classes and their interfaces.
 */
export function collectParentPropertyNames(cls: NormalizedClass, repo: GirRepository): Set<string> {
    return collectParentMemberNames(
        cls,
        repo,
        (c) => c.properties,
        (i) => i.properties,
        toCamelCase,
    );
}

/**
 * Collects signal names from all parent classes and their interfaces.
 */
export function collectParentSignalNames(cls: NormalizedClass, repo: GirRepository): Set<string> {
    return collectParentMemberNames(
        cls,
        repo,
        (c) => c.signals,
        (i) => i.signals,
        toCamelCase,
    );
}

/**
 * Collects method names from all parent classes and their interfaces.
 */
export function collectParentMethodNames(cls: NormalizedClass, repo: GirRepository): Set<string> {
    return collectParentMemberNames(
        cls,
        repo,
        (c) => c.methods,
        (i) => i.methods,
    );
}

/**
 * Collects factory method names (from constructors) from all parent classes.
 * These names are the camelCase versions of constructor names (e.g., new_from_template → newFromTemplate).
 * Used to detect when a subclass's factory method would conflict with a parent's.
 */
export function collectParentFactoryMethodNames(cls: NormalizedClass): Set<string> {
    const names = new Set<string>();

    let current = cls.getParent();
    while (current) {
        for (const ctor of current.constructors) {
            names.add(toCamelCase(ctor.name));
        }
        current = current.getParent();
    }

    return names;
}

/**
 * Options for collecting direct members.
 */
export type CollectDirectMembersOptions<T extends { name: string }> = {
    /** The class to analyze */
    cls: NormalizedClass;
    /** GIR repository for interface resolution */
    repo: GirRepository;
    /** Function to extract members from a class */
    getClassMembers: (c: NormalizedClass) => readonly T[];
    /** Function to extract members from an interface */
    getInterfaceMembers: (i: NormalizedInterface) => readonly T[];
    /** Function to get parent member names (already collected) */
    getParentNames: (cls: NormalizedClass, repo: GirRepository) => Set<string>;
    /** Optional function to transform member names (e.g., toCamelCase) */
    transformName?: (name: string) => string;
    /** Optional predicate to filter hidden members */
    isHidden?: (transformedName: string) => boolean;
};

/**
 * Collects direct members from a class, excluding inherited members.
 * Also includes members from interfaces this class directly implements
 * (not from parent-implemented interfaces).
 *
 * This is the generic version of the filtering logic used by PropertyAnalyzer
 * and SignalAnalyzer. It extracts the common DRY pattern.
 *
 * @returns Array of direct members from the class and its direct interfaces
 */
export function collectDirectMembers<T extends { name: string }>(options: CollectDirectMembersOptions<T>): T[] {
    const {
        cls,
        repo,
        getClassMembers,
        getInterfaceMembers,
        getParentNames,
        transformName = (n) => n,
        isHidden = () => false,
    } = options;
    const parentNames = getParentNames(cls, repo);

    const directMembers = getClassMembers(cls).filter((member) => {
        const transformedName = transformName(member.name);
        return !parentNames.has(transformedName) && !isHidden(transformedName);
    });

    const parentInterfaces = collectParentInterfaces(cls);
    const allDirectMembers = [...directMembers];

    for (const ifaceQName of cls.implements) {
        if (parentInterfaces.has(ifaceQName)) continue;
        const iface = repo.resolveInterface(ifaceQName);
        if (!iface) continue;

        for (const member of getInterfaceMembers(iface)) {
            const transformedName = transformName(member.name);
            if (parentNames.has(transformedName) || isHidden(transformedName)) continue;
            if (allDirectMembers.some((m) => m.name === member.name)) continue;
            allDirectMembers.push(member);
        }
    }

    return allDirectMembers;
}
