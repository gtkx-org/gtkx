type ExternalNamespace = { namespace: string; packageName: string };

const EXTERNAL_NAMESPACES: ExternalNamespace[] = [{ namespace: "cairo", packageName: "@gtkx/cairo" }];

const externalPackageFor = (namespaceName: string): string | undefined =>
    EXTERNAL_NAMESPACES.find((entry) => entry.namespace === namespaceName)?.packageName;

const EXTERNAL_RECORD_FREE_FUNCTIONS: Map<string, string> = new Map([["cairo_path_t", "cairo_path_destroy"]]);
const EXTERNAL_RECORD_COPY_STRATEGIES: Map<string, "cairo-path"> = new Map([["cairo_path_t", "cairo-path"]]);

const EXTERNAL_CALLER_ALLOCATORS: Map<string, string> = new Map([["cairo.Matrix", "initIdentity"]]);

export {
    EXTERNAL_NAMESPACES,
    EXTERNAL_RECORD_FREE_FUNCTIONS,
    EXTERNAL_RECORD_COPY_STRATEGIES,
    EXTERNAL_CALLER_ALLOCATORS,
    externalPackageFor,
};
