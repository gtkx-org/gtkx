type ExternalNamespace = { namespace: string; packageName: string };

const EXTERNAL_NAMESPACES: ExternalNamespace[] = [{ namespace: "cairo", packageName: "@gtkx/cairo" }];

const externalPackageFor = (namespaceName: string): string | undefined =>
    EXTERNAL_NAMESPACES.find((entry) => entry.namespace === namespaceName)?.packageName;

export { EXTERNAL_NAMESPACES, externalPackageFor };
