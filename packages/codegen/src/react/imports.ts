/**
 * Shared import accumulator for the per-namespace `@gtkx/react-gi` modules.
 *
 * The intrinsic/Props section ({@link ../react/jsx.js}) and the compounds
 * section ({@link ../react/compounds.js}) both contribute to one module file, so
 * their import needs merge into a single {@link ReactGiImports} record the
 * pipeline renders once. Keeping the accumulator separate from each section's
 * body keeps a namespace module's import block free of duplicate specifiers.
 */

/** Mutable record of every import a per-namespace `@gtkx/react-gi` module needs. */
export type ReactGiImports = {
    /** Named type imports from `react` (e.g. `ReactNode`, `Ref`). */
    readonly reactBuiltins: Set<string>;
    /** GIR namespace value-namespace aliases keyed by namespace name (`Gtk` → `Gtk`). */
    readonly giNamespaces: Map<string, string>;
    /** Value imports from `@gtkx/react` (the top-level surface HOCs). */
    readonly hocs: Set<string>;
    /** Type imports from `@gtkx/react` (shared prop/item types like `ScaleMark`). */
    readonly sharedTypes: Set<string>;
    /** Cross-namespace `Props` type imports keyed by `@gtkx/react-gi/<dir>` directory. */
    readonly crossNsProps: Map<string, Set<string>>;
};

/** Creates an empty {@link ReactGiImports} accumulator. */
export const emptyReactGiImports = (): ReactGiImports => ({
    reactBuiltins: new Set<string>(),
    giNamespaces: new Map<string, string>(),
    hocs: new Set<string>(),
    sharedTypes: new Set<string>(),
    crossNsProps: new Map<string, Set<string>>(),
});

const sortedList = (values: Iterable<string>): readonly string[] => [...values].sort((a, b) => a.localeCompare(b));

/**
 * Renders the merged import (and re-export) block for one namespace module,
 * led by the `@gtkx/gi/<ns>` side-effect import that loads the namespace.
 *
 * @param targetDirectory - The lowercased namespace directory (`"gtk"`)
 * @param imports - The accumulated import needs
 */
export const renderReactGiImports = (targetDirectory: string, imports: ReactGiImports): string => {
    const lines: string[] = [`import "@gtkx/gi/${targetDirectory}";`];
    if (imports.reactBuiltins.size > 0) {
        lines.push(`import type { ${sortedList(imports.reactBuiltins).join(", ")} } from "react";`);
    }
    if (imports.hocs.size > 0) {
        lines.push(`import { ${sortedList(imports.hocs).join(", ")} } from "@gtkx/react";`);
    }
    if (imports.sharedTypes.size > 0) {
        lines.push(`import type { ${sortedList(imports.sharedTypes).join(", ")} } from "@gtkx/react";`);
    }
    for (const [namespaceName, alias] of [...imports.giNamespaces].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (namespaceName === "") continue;
        lines.push(`import type * as ${alias} from "@gtkx/gi/${namespaceName.toLowerCase()}";`);
    }
    for (const [directory, names] of [...imports.crossNsProps].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (directory === targetDirectory) continue;
        lines.push(`import type { ${sortedList(names).join(", ")} } from "@gtkx/react-gi/${directory}";`);
    }
    return lines.join("\n");
};
