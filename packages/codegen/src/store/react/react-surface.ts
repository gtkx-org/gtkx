/** Static per-element facts read from the installed `@gtkx/react` package and threaded into codegen. */
export type ReactSurface = {
    /** Hand-declared props interface names (`${element}Props`) mapped to the module that exports them. */
    propInterfaces: Record<string, string>;
    /** GLib type names of the framework's lazy (parent-created) elements. */
    lazyElements: string[];
};

/** Scans `@gtkx/react` prop-type source for its exported `*Props` names, keyed to the exporting module. */
export const scanPropInterfaces = (sources: { content: string; module: string }[]): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const { content, module } of sources) {
        for (const match of content.matchAll(/export\s+(?:interface|type)\s+(\w+Props)\b/g)) {
            if (match[1] !== undefined) result[match[1]] = module;
        }
    }
    return result;
};

/** Extracts the string literals from the framework's `element-metadata` lazy-elements module. */
export const parseLazyElements = (content: string): string[] =>
    [...content.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "").filter((name) => name.length > 0);
