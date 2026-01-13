/**
 * Default Value Utilities
 *
 * Converts GIR DefaultValue to TypeScript initializer strings.
 */

import type { DefaultValue, GirRepository } from "@gtkx/gir";
import { toConstantCase, toPascalCase } from "./naming.js";

type EnumResolution = {
    enumName: string;
    memberName: string;
    namespace: string;
};

function resolveEnumByCIdentifier(cIdentifier: string, repo: GirRepository): EnumResolution | null {
    for (const [, ns] of repo.getAllNamespaces()) {
        for (const [, enumeration] of ns.enumerations) {
            for (const member of enumeration.members) {
                if (member.cIdentifier === cIdentifier) {
                    return {
                        enumName: toPascalCase(enumeration.name),
                        memberName: toConstantCase(member.name),
                        namespace: ns.name,
                    };
                }
            }
        }

        for (const [, bitfield] of ns.bitfields) {
            for (const member of bitfield.members) {
                if (member.cIdentifier === cIdentifier) {
                    return {
                        enumName: toPascalCase(bitfield.name),
                        memberName: toConstantCase(member.name),
                        namespace: ns.name,
                    };
                }
            }
        }
    }

    return null;
}

export type DefaultValueConversion = {
    initializer: string;
    imports: Array<{ name: string; namespace: string }>;
};

/**
 * Converts a GIR DefaultValue to a TypeScript initializer string.
 *
 * @param defaultValue - The parsed default value from GIR
 * @param repo - The GIR repository for enum resolution
 * @param currentNamespace - The current namespace (to determine if import is needed)
 * @returns The TypeScript initializer and any required imports, or null if not convertible
 */
export function convertDefaultValue(
    defaultValue: DefaultValue | null,
    repo: GirRepository,
    currentNamespace: string,
): DefaultValueConversion | null {
    if (!defaultValue) {
        return null;
    }

    switch (defaultValue.kind) {
        case "null":
            return { initializer: "null", imports: [] };

        case "boolean":
            return { initializer: defaultValue.value ? "true" : "false", imports: [] };

        case "number":
            return { initializer: String(defaultValue.value), imports: [] };

        case "string":
            return { initializer: JSON.stringify(defaultValue.value), imports: [] };

        case "enum": {
            const resolution = resolveEnumByCIdentifier(defaultValue.cIdentifier, repo);
            if (!resolution) {
                return null;
            }

            const needsImport = resolution.namespace !== currentNamespace;
            const prefix = needsImport ? `${resolution.namespace}.` : "";
            const initializer = `${prefix}${resolution.enumName}.${resolution.memberName}`;

            const imports: Array<{ name: string; namespace: string }> = [];
            if (needsImport) {
                imports.push({ name: resolution.enumName, namespace: resolution.namespace });
            }

            return { initializer, imports };
        }

        case "unknown":
            return null;
    }
}
