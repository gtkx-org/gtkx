import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { generateCompoundsSection } from "./compounds.js";
import { emptyReactGiImports, renderReactGiImports } from "./imports.js";
import { generateJsxSection } from "./jsx.js";
import { generateMetadata } from "./metadata.js";
import { mergeArrayProps, mergeContainerSlots, mergeWidgetSlots } from "./slots.js";
import { collectReactNodeClasses } from "./widgets.js";

/**
 * User-supplied slot overrides from `gtkx.config.ts`, keyed by JSX element
 * name with camelCase string values.
 */
export type UserSlots = {
    /** Widget-typed properties to surface as setter-semantics `ReactNode` slots. */
    readonly widgetSlots?: Readonly<Record<string, readonly string[]>>;
    /** Container methods to surface as append-semantics `ReactNode` slots. */
    readonly containerSlots?: Readonly<Record<string, readonly string[]>>;
    /** Array-valued props keyed by JSX element name then camelCase prop name to item-type name. */
    readonly arrayProps?: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

/**
 * Widget names whose public element `@gtkx/react` owns through a hand-written
 * enhanced component (a controller-backed list, a menu-resolving button, a
 * Cairo drawing area, …). A namespace module emits neither an intrinsic const
 * nor a compound for these — only the `Props` interface and the JSX-element
 * augmentation, which the hand-written component renders against. The app imports
 * the component from `@gtkx/react`; the namespace module stays free of a
 * competing export.
 */
const RUNTIME_OWNED_WIDGETS: ReadonlySet<string> = new Set([
    "GtkColumnView",
    "GtkColumnViewColumn",
    "GtkConstraintLayout",
    "GtkDrawingArea",
    "GtkDropDown",
    "GtkGridView",
    "GtkListView",
    "GtkMenuButton",
    "GtkPopoverMenu",
    "GtkPopoverMenuBar",
    "GtkSizeGroup",
    "AdwComboRow",
    "AdwSpringAnimation",
    "AdwTimedAnimation",
    "WebKitWebView",
]);

/** One per-namespace `@gtkx/react-gi` module: its directory and combined source. */
export type ReactGiNamespaceFile = {
    /** Lowercased namespace directory name (e.g. `"gtk"`). */
    readonly directory: string;
    /** The combined namespace module source. */
    readonly source: string;
};

/** Result of {@link generateReactGiFiles}. */
export type ReactGiFiles = {
    /** Per-namespace module sources. */
    readonly namespaces: readonly ReactGiNamespaceFile[];
    /** The merged metadata module source. */
    readonly metadata: string;
    /** Number of widget intrinsics emitted across all namespaces. */
    readonly widgetCount: number;
};

/**
 * Produces the per-namespace `@gtkx/react-gi` module sources plus the single
 * merged `metadata.ts`. A namespace gets a module when it contributes at least
 * one React-node class. Each module combines the intrinsic/Props section, the
 * compounds section, the runtime-component re-exports, and the `@gtkx/gi/<ns>`
 * side-effect import.
 *
 * @param repository - The loaded GIR repository
 * @param userSlots - Widget-, container-, and array-prop overrides from `gtkx.config.ts`
 */
export const generateReactGiFiles = (repository: GirRepository, userSlots: UserSlots = {}): ReactGiFiles => {
    const widgetSlotMap = mergeWidgetSlots(userSlots.widgetSlots);
    const containerSlotMap = mergeContainerSlots(userSlots.containerSlots);
    const arrayPropMap = mergeArrayProps(userSlots.arrayProps);

    const namespacesWithWidgets = new Map<string, GirNamespace>();
    for (const entry of collectReactNodeClasses(repository)) {
        namespacesWithWidgets.set(entry.namespace.name, entry.namespace);
    }

    const namespaces: ReactGiNamespaceFile[] = [];
    let widgetCount = 0;
    for (const namespace of [...namespacesWithWidgets.values()].sort((a, b) => a.name.localeCompare(b.name))) {
        const { source, count } = generateReactGiNamespace(namespace, repository, {
            widgetSlotMap,
            containerSlotMap,
            arrayPropMap,
        });
        namespaces.push({ directory: namespace.name.toLowerCase(), source });
        widgetCount += count;
    }

    return { namespaces, metadata: generateMetadata(repository), widgetCount };
};

/**
 * Generates one namespace's combined `@gtkx/react-gi` module: imports + the
 * compounds section + the intrinsic/Props section. Compound-exported names and
 * re-exported runtime components are excluded from the intrinsic consts so the
 * module has no duplicate exports.
 *
 * @param targetNamespace - The namespace this module is generated for
 * @param repository - The loaded GIR repository
 * @param maps - Merged widget-slot, container-slot, and array-prop maps
 */
const generateReactGiNamespace = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
    maps: {
        readonly widgetSlotMap: Readonly<Record<string, readonly string[]>>;
        readonly containerSlotMap: Readonly<Record<string, readonly string[]>>;
        readonly arrayPropMap: Readonly<Record<string, Readonly<Record<string, string>>>>;
    },
): { readonly source: string; readonly count: number } => {
    const imports = emptyReactGiImports();

    const compounds = generateCompoundsSection(targetNamespace, repository, {
        widgetSlotMap: maps.widgetSlotMap,
        containerSlotMap: maps.containerSlotMap,
        imports,
        excludeNames: RUNTIME_OWNED_WIDGETS,
    });
    const excludeNames = new Set<string>([...compounds.exportedNames, ...RUNTIME_OWNED_WIDGETS]);
    const jsxSection = generateJsxSection(targetNamespace, repository, { excludeNames, maps, imports });

    const body = [renderReactGiImports(targetNamespace.name.toLowerCase(), imports), "", jsxSection];
    if (compounds.source.length > 0) body.push("", compounds.source);

    const count = jsxSection.split("\n").filter((line) => line.startsWith("export const ")).length;
    return { source: `${body.join("\n")}\n`, count };
};
