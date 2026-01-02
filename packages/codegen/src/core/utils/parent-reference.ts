/**
 * Parent class reference parsing utilities.
 *
 * Shared logic for parsing parent class references from qualified names.
 */

import type { QualifiedName } from "@gtkx/gir";
import { parseQualifiedName } from "@gtkx/gir";
import { normalizeClassName, toKebabCase } from "./naming.js";

/**
 * Information about a parsed parent class reference.
 */
export type ParentInfo = {
    /** Whether the type has a parent */
    hasParent: boolean;
    /** Whether the parent is in a different namespace */
    isCrossNamespace: boolean;
    /** Parent namespace (only set if cross-namespace) */
    namespace?: string;
    /** Normalized parent class name */
    className: string;
    /** Original parent name (for file path generation) */
    originalName: string;
    /** Import statement (for same-namespace parents) */
    importStatement?: string;
    /** Extends clause for class declaration */
    extendsClause: string;
};

/**
 * Parses a parent class reference into structured information.
 *
 * @param parent - The parent qualified name (or null/undefined)
 * @param currentNamespace - The namespace of the current type
 * @returns Parsed parent information
 *
 * @example
 * ```typescript
 * const info = parseParentReference("Gtk.Widget", "Gtk");
 * // { hasParent: true, isCrossNamespace: false, className: "Widget", ... }
 *
 * const crossNs = parseParentReference("GObject.Object", "Gtk");
 * // { hasParent: true, isCrossNamespace: true, namespace: "GObject", ... }
 * ```
 */
export const parseParentReference = (
    parent: QualifiedName | string | null | undefined,
    currentNamespace: string,
): ParentInfo => {
    if (!parent) {
        return {
            hasParent: false,
            isCrossNamespace: false,
            className: "",
            originalName: "",
            extendsClause: " extends NativeObject",
        };
    }

    const { namespace: ns, name: originalName } = parseQualifiedName(parent as QualifiedName);
    const normalizedClass = normalizeClassName(originalName, ns);
    const isCrossNamespace = ns !== currentNamespace;

    if (isCrossNamespace) {
        return {
            hasParent: true,
            isCrossNamespace: true,
            namespace: ns,
            className: normalizedClass,
            originalName,
            extendsClause: ` extends ${ns}.${normalizedClass}`,
        };
    }

    return {
        hasParent: true,
        isCrossNamespace: false,
        className: normalizedClass,
        originalName,
        extendsClause: ` extends ${normalizedClass}`,
        importStatement: `import { ${normalizedClass} } from "./${toKebabCase(originalName)}.js";`,
    };
};
