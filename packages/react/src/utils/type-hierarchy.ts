import * as GObject from "@gtkx/gi/gobject";
import { getOrInsert } from "@gtkx/utils";

const typeNameChainCache = new Map<bigint, string[]>();
const interfaceNamesCache = new Map<bigint, string[]>();
const typeNameSetCache = new Map<bigint, Set<string>>();
const typeNamesWithInterfacesCache = new Map<bigint, string[]>();

export const collectTypeNameChain = (gtype: bigint): string[] =>
    getOrInsert(typeNameChainCache, gtype, () => {
        const chain: string[] = [];
        let current = gtype;
        while (current !== 0n) {
            const name = GObject.typeName(current);
            if (!name) break;
            chain.push(name);
            current = GObject.typeParent(current);
        }
        return chain;
    });

const collectInterfaceNames = (gtype: bigint): string[] =>
    getOrInsert(interfaceNamesCache, gtype, () => {
        const names: string[] = [];
        for (const iface of GObject.typeInterfaces(gtype)) {
            const name = GObject.typeName(iface);
            if (name) names.push(name);
        }
        return names;
    });

export const collectTypeNamesWithInterfaces = (gtype: bigint): string[] =>
    getOrInsert(typeNamesWithInterfacesCache, gtype, () => [
        ...collectTypeNameChain(gtype),
        ...collectInterfaceNames(gtype),
    ]);

export const foldInheritedTable = <R, T>(
    gtype: bigint,
    table: Record<string, R>,
    fold: (accumulator: T, row: R) => T,
    seed: T,
): T => {
    let accumulator = seed;
    for (const name of collectTypeNameChain(gtype)) {
        const row = table[name];
        if (row !== undefined) accumulator = fold(accumulator, row);
    }
    return accumulator;
};

export const foldInheritedTableWithInterfaces = <R, T>(
    gtype: bigint,
    table: Record<string, R>,
    fold: (accumulator: T, row: R) => T,
    seed: T,
): T => {
    let accumulator = foldInheritedTable(gtype, table, fold, seed);
    for (const name of collectInterfaceNames(gtype)) {
        const row = table[name];
        if (row !== undefined) accumulator = fold(accumulator, row);
    }
    return accumulator;
};

export const hasTypeInChain = (gtype: bigint, name: string): boolean =>
    getOrInsert(typeNameSetCache, gtype, () => new Set(collectTypeNameChain(gtype))).has(name);
