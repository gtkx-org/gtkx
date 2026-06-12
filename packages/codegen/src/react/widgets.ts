import { toCamelCase, toIdentifier, toUpperFirst } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import { splitQualifiedName } from "../gir/qualified-name.js";
import type { GirRepository } from "../gir/repository.js";

/**
 * Maps a kebab-case signal name to its `on`-prefixed camelCase handler prop
 * name (e.g. `value-changed` → `onValueChanged`).
 *
 * @param signalName - The GIR signal name
 */
export const signalHandlerName = (signalName: string): string =>
    `on${toUpperFirst(toIdentifier(toCamelCase(signalName)))}`;

/** A class qualified by its declaring namespace and the GLib type name it exposes. */
export type WidgetCandidate = {
    readonly glibName: string;
    readonly klass: GirClass;
    readonly namespace: GirNamespace;
};

/**
 * Iterates every `(class, namespace, glibName)` triple in the repository whose
 * `glib:type-name` (or C type fallback) is defined.
 *
 * The order follows GIR file order within a namespace and `namespaces` map
 * iteration order between namespaces; callers that need stable output should
 * sort the result themselves.
 *
 * @param repository - The repository to walk
 */
export function* iterateClassesWithGlibName(repository: GirRepository): IterableIterator<WidgetCandidate> {
    for (const namespace of repository.namespaces.values()) {
        for (const klass of namespace.classes) {
            const glibName = klass.glibTypeName ?? klass.cType;
            if (glibName === undefined) continue;
            yield { glibName, klass, namespace };
        }
    }
}

const resolveParentClass = (
    repository: GirRepository,
    parent: string,
    namespace: GirNamespace,
): { readonly klass: GirClass; readonly namespace: GirNamespace } | undefined => {
    const { namespaceName, typeName } = splitQualifiedName(parent, namespace.name);
    const resolved = repository.resolveNamed(namespaceName, typeName);
    if (resolved === undefined || (resolved.kind !== "class" && resolved.kind !== "interface")) return undefined;
    return { klass: resolved.value, namespace: resolved.namespace };
};

/** A resolved interface qualified by the namespace that declares it. */
export type ResolvedQualifiedInterface = { readonly klass: GirClass; readonly namespace: GirNamespace };

/**
 * Resolves every interface a class implements, including the transitive
 * prerequisite interfaces of those interfaces, nearest first.
 *
 * Interfaces never appear in the GObject type-parent chain, so the React
 * runtime cannot reach an interface's signals or properties by walking a
 * widget's ancestors. Each implementing class must therefore carry its
 * interfaces' metadata directly. Prerequisite interfaces (e.g. a
 * `Gtk.SelectionModel`'s `Gio.ListModel`) are folded in transitively; class
 * prerequisites are ignored because their metadata is reachable through the
 * type-parent chain.
 *
 * @param klass - The class whose interfaces to resolve
 * @param namespace - The namespace the class lives in
 * @param repository - The repository for cross-namespace lookups
 */
export const implementedInterfaces = (
    klass: GirClass,
    namespace: GirNamespace,
    repository: GirRepository,
): readonly ResolvedQualifiedInterface[] => {
    const result: ResolvedQualifiedInterface[] = [];
    const visited = new Set<string>();
    const visit = (names: readonly string[], fromNamespace: GirNamespace): void => {
        for (const name of names) {
            const { namespaceName, typeName } = splitQualifiedName(name, fromNamespace.name);
            const resolved = repository.resolveNamed(namespaceName, typeName);
            if (resolved === undefined || resolved.kind !== "interface") continue;
            const key = `${resolved.namespace.name}.${resolved.value.name}`;
            if (visited.has(key)) continue;
            visited.add(key);
            result.push({ klass: resolved.value, namespace: resolved.namespace });
            visit(resolved.value.prerequisites, resolved.namespace);
        }
    };
    visit(klass.implements, namespace);
    return result;
};

/**
 * Returns the GLib type names of a class and every ancestor it descends from,
 * nearest first. Used to let a subclass inherit widget-slot declarations made
 * on its ancestors.
 *
 * @param klass - The class to start from
 * @param namespace - The namespace the class lives in
 * @param repository - The repository for cross-namespace parent lookups
 */
export const ancestorGlibNames = (
    klass: GirClass,
    namespace: GirNamespace,
    repository: GirRepository,
): readonly string[] => {
    const names: string[] = [];
    let currentClass: GirClass | undefined = klass;
    let currentNamespace: GirNamespace | undefined = namespace;
    while (currentClass !== undefined && currentNamespace !== undefined) {
        const glibName = currentClass.glibTypeName ?? currentClass.cType;
        if (glibName !== undefined) names.push(glibName);
        if (currentClass.parent === undefined) break;
        const next = resolveParentClass(repository, currentClass.parent, currentNamespace);
        if (next === undefined) break;
        currentClass = next.klass;
        currentNamespace = next.namespace;
    }
    return names;
};

const someAncestor = (
    klass: GirClass,
    namespace: GirNamespace,
    repository: GirRepository,
    predicate: (klass: GirClass, glibName: string) => boolean,
): boolean => {
    let currentClass: GirClass | undefined = klass;
    let currentNamespace: GirNamespace | undefined = namespace;
    while (currentClass !== undefined && currentNamespace !== undefined) {
        const glibName = currentClass.glibTypeName ?? currentClass.cType ?? "";
        if (predicate(currentClass, glibName)) return true;
        if (currentClass.parent === undefined) return false;
        const next = resolveParentClass(repository, currentClass.parent, currentNamespace);
        if (next === undefined) return false;
        currentClass = next.klass;
        currentNamespace = next.namespace;
    }
    return false;
};

const descendsFrom = (
    klass: GirClass,
    namespace: GirNamespace,
    repository: GirRepository,
    matches: (glibName: string) => boolean,
): boolean => someAncestor(klass, namespace, repository, (_klass, glibName) => matches(glibName));

/**
 * Whether `klass` or any ancestor declares a method named `methodName`,
 * mirroring the reconciler's duck-typed method probes (e.g.
 * `isSingleChildContainer`'s `set_child` check). Used to recognize the
 * single-child container relationship at codegen time so its `child` property
 * stays a nested child rather than being widened into a redundant slot.
 *
 * @param klass - The class to start from
 * @param namespace - The namespace the class lives in
 * @param repository - The repository for cross-namespace parent lookups
 * @param methodName - The GIR (snake_case) method name to look for
 */
export const classExposesMethod = (
    klass: GirClass,
    namespace: GirNamespace,
    repository: GirRepository,
    methodName: string,
): boolean =>
    someAncestor(klass, namespace, repository, (current) => current.methods.some((m) => m.name === methodName));

/**
 * Decides whether a `<class>` is a React reconciler node — any instantiable
 * GObject (a direct or transitive descendant of `GObject.Object`). Every such
 * class is a valid JSX element, so codegen emits prop, signal, and
 * construct-only metadata for all of them: widgets, event controllers, layout
 * managers, and plain objects such as `Gio.Menu` or `Gtk.StringList` that
 * participate in the tree as slot values.
 *
 * @param klass - The class to inspect
 * @param namespace - The namespace the class lives in
 * @param repository - The repository for cross-namespace parent lookups
 */
export const isReactNodeClass = (klass: GirClass, namespace: GirNamespace, repository: GirRepository): boolean =>
    descendsFrom(klass, namespace, repository, (glibName) => glibName === "GObject");

/**
 * Collects every React-node class in the repository, deduplicated by GLib type
 * name and sorted alphabetically by it. Shared by the `jsx.ts` intrinsic emitter
 * and the `compounds.tsx` compound emitter so both walk the same stable set.
 *
 * @param repository - The loaded GIR repository
 */
export const collectReactNodeClasses = (repository: GirRepository): readonly WidgetCandidate[] => {
    const seen = new Set<string>();
    const entries: WidgetCandidate[] = [];
    for (const candidate of iterateClassesWithGlibName(repository)) {
        const { glibName, klass, namespace } = candidate;
        if (!isReactNodeClass(klass, namespace, repository)) continue;
        if (seen.has(glibName)) continue;
        seen.add(glibName);
        entries.push(candidate);
    }
    return entries.sort((a, b) => a.glibName.localeCompare(b.glibName));
};
