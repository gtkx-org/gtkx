import { sortedStrings, sortedStringsBy } from "@gtkx/utils";

export type JsxImports = {
    reactBuiltins: Set<string>;
    giNamespaces: Map<string, string>;
    hocs: Set<string>;
    sharedTypes: Set<string>;
    crossNsProps: Map<string, Set<string>>;
};

export const emptyJsxImports = (): JsxImports => ({
    reactBuiltins: new Set<string>(),
    giNamespaces: new Map<string, string>(),
    hocs: new Set<string>(),
    sharedTypes: new Set<string>(),
    crossNsProps: new Map<string, Set<string>>(),
});

export const renderJsxImports = (targetDirectory: string, imports: JsxImports): string => {
    const lines: string[] = [`import "@gtkx/gi/${targetDirectory}";`];
    if (imports.reactBuiltins.size > 0) {
        lines.push(`import type { ${sortedStrings(imports.reactBuiltins).join(", ")} } from "react";`);
    }
    if (imports.hocs.size > 0) {
        lines.push(`import { ${sortedStrings(imports.hocs).join(", ")} } from "@gtkx/react";`);
    }
    if (imports.sharedTypes.size > 0) {
        lines.push(`import type { ${sortedStrings(imports.sharedTypes).join(", ")} } from "@gtkx/react";`);
    }
    for (const [namespaceName, alias] of sortedStringsBy(imports.giNamespaces, ([name]) => name)) {
        if (namespaceName === "") continue;
        lines.push(`import type * as ${alias} from "@gtkx/gi/${namespaceName.toLowerCase()}";`);
    }
    for (const [directory, names] of sortedStringsBy(imports.crossNsProps, ([dir]) => dir)) {
        if (directory === targetDirectory) continue;
        lines.push(`import type { ${sortedStrings(names).join(", ")} } from "@gtkx/jsx/${directory}";`);
    }
    return lines.join("\n");
};
