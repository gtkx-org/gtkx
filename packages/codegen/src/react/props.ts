import { toCamelCase, toIdentifier, toUpperFirst } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import { type GirParameter, isInoutParameter, isOutParameter } from "../gir/parameter.js";
import type { GirProperty } from "../gir/property.js";
import { resolveQualifiedClass, splitQualifiedName } from "../gir/qualified-name.js";
import { qualifyTypeRef } from "../gir/qualify.js";
import type { GirRepository } from "../gir/repository.js";
import type { GirSignal } from "../gir/signal.js";
import type { GirTypeRef, NamedTypeRef } from "../gir/type-ref.js";
import { renderHandlerParameters } from "../writers/param-classify.js";
import { renderBaseTypeFor, type TsTypeTarget } from "../writers/ts-type.js";
import { isScalarRef } from "../writers/value.js";
import { signalHandlerName } from "./widgets.js";

/**
 * Rendered prop entries for a single widget's Props interface, together
 * with imports the writer must request to keep type references valid.
 */
export type WidgetPropsEntries = {
    /** Rendered prop lines, indented one level inside the interface body. */
    readonly propLines: readonly string[];
    /** Cross-namespace imports the writer must add to the surrounding module. */
    readonly imports: ReadonlyMap<string, string>;
};

/**
 * Options for {@link buildWidgetPropsEntries}.
 */
export type WidgetPropsOptions = {
    /** The full GIR repository. */
    readonly repository: GirRepository;
    /** The widget class whose props bag is being built. */
    readonly klass: GirClass;
    /** Property names that should be widened to `ReactNode` slot children. */
    readonly slotPropNames?: ReadonlySet<string>;
    /** Property names whose raw GObject emission is suppressed in favor of a data-prop surface (array, object, or virtual rows). */
    readonly dataPropNames?: ReadonlySet<string>;
    /** Returns `true` when `candidate` already has its own widget Props interface. */
    readonly isWidgetAncestor?: (candidate: GirClass) => boolean;
    /** Qualified `Namespace.Alias` names surfaced as `bigint`. */
    readonly bigintAliases?: ReadonlySet<string>;
};

/**
 * Everything the prop-type renderers need beyond the type reference itself:
 * the repository for named-type resolution, the import accumulator the
 * rendering populates, and the bigint alias allowlist.
 */
type PropTypeRenderContext = {
    readonly repository: GirRepository;
    readonly imports: Map<string, string>;
    readonly bigintAliases: ReadonlySet<string>;
};

type SignalRenderOptions = {
    readonly types: PropTypeRenderContext;
    readonly signal: GirSignal;
    readonly selfType: string;
    readonly owningNamespace: string;
};

type ParentRef = { readonly klass: GirClass; readonly namespaceName: string };

/**
 * Builds a typed prop bag for one widget intrinsic.
 *
 * Combines the widget's own properties + signal handlers with those declared
 * by its directly-implemented interfaces and by every non-widget ancestor up
 * to the first widget parent (whose props are inherited via `extends`).
 * Property types are written as TypeScript surface types resolved against the
 * loaded GIR repository.
 *
 * @param options - {@link WidgetPropsOptions}
 */
export const buildWidgetPropsEntries = (options: WidgetPropsOptions): WidgetPropsEntries => {
    const {
        repository,
        klass,
        slotPropNames = new Set<string>(),
        dataPropNames = new Set<string>(),
        isWidgetAncestor = () => false,
        bigintAliases = new Set<string>(),
    } = options;
    const imports = new Map<string, string>();
    const types: PropTypeRenderContext = { repository, imports, bigintAliases };
    const propEntries: string[] = [];
    const seen = new Set<string>();

    const ownerName = klass.glibTypeName ?? klass.cType ?? klass.name;
    const selfNamespace = currentNamespaceKey(repository, klass);

    const acceptProperty = (property: GirProperty, owningNamespace: string): void => {
        if (!property.introspectable) return;
        const jsName = toIdentifier(toCamelCase(property.name));
        if (seen.has(jsName)) return;
        seen.add(jsName);
        if (isPropOverridden(ownerName, jsName)) return;
        if (dataPropNames.has(jsName)) return;
        if (slotPropNames.has(jsName)) {
            propEntries.push(`${jsName}?: ReactNode | null;`);
            return;
        }
        const qualified = qualifyTypeRef(property.type, owningNamespace);
        const tsType = renderReactPropType(types, qualified, false);
        propEntries.push(`${jsName}?: ${tsType} | null;`);
        propEntries.push(`onNotify${toUpperFirst(jsName)}?: ((value: ${tsType} | null, self: Self) => void) | null;`);
    };

    const acceptSignal = (signal: GirSignal, owningNamespace: string): void => {
        const handlerName = signalHandlerName(signal.name);
        if (seen.has(handlerName)) return;
        seen.add(handlerName);
        const signature = renderSignalHandler({
            types,
            signal,
            selfType: "Self",
            owningNamespace,
        });
        propEntries.push(`${handlerName}?: ${signature};`);
    };

    visitClassAndAncestors({ repository, klass, selfNamespace, isWidgetAncestor }, acceptProperty, acceptSignal);

    return { propLines: propEntries, imports };
};

type WalkContext = {
    readonly repository: GirRepository;
    readonly klass: GirClass;
    readonly selfNamespace: string;
    readonly isWidgetAncestor: (candidate: GirClass) => boolean;
};

const visitClassAndAncestors = (
    walk: WalkContext,
    acceptProperty: (property: GirProperty, owningNamespace: string) => void,
    acceptSignal: (signal: GirSignal, owningNamespace: string) => void,
): void => {
    const visit = (current: GirClass, owningNamespace: string): void => {
        for (const property of current.properties) acceptProperty(property, owningNamespace);
        for (const signal of current.signals) acceptSignal(signal, owningNamespace);
        for (const implementsName of current.implements) {
            const resolved = resolveInterface(walk.repository, current, implementsName);
            if (resolved === undefined) continue;
            for (const property of resolved.value.properties) acceptProperty(property, resolved.namespace.name);
            for (const signal of resolved.value.signals) acceptSignal(signal, resolved.namespace.name);
        }
    };

    visit(walk.klass, walk.selfNamespace);
    const visited = new Set<string>([`${walk.selfNamespace}.${walk.klass.name}`]);
    let parentRef = resolveParent(walk.repository, walk.klass, walk.selfNamespace);
    while (parentRef !== undefined && !walk.isWidgetAncestor(parentRef.klass)) {
        const key = `${parentRef.namespaceName}.${parentRef.klass.name}`;
        if (visited.has(key)) break;
        visited.add(key);
        visit(parentRef.klass, parentRef.namespaceName);
        parentRef = resolveParent(walk.repository, parentRef.klass, parentRef.namespaceName);
    }
};

const resolveParent = (repository: GirRepository, klass: GirClass, defaultNamespace: string): ParentRef | undefined => {
    if (klass.parent === undefined) return undefined;
    return resolveQualifiedClass(repository, klass.parent, defaultNamespace);
};

const currentNamespaceKey = (repository: GirRepository, klass: GirClass): string => {
    for (const namespace of repository.namespaces.values()) {
        if (namespace.classes.includes(klass) || namespace.interfaces.includes(klass)) {
            return namespace.name;
        }
    }
    return "?";
};

const resolveInterface = (
    repository: GirRepository,
    declaringClass: GirClass,
    implementsName: string,
): { readonly namespace: GirNamespace; readonly value: GirClass } | undefined => {
    const { namespaceName, typeName } = splitQualifiedName(
        implementsName,
        currentNamespaceKey(repository, declaringClass),
    );
    const resolved = repository.resolveNamed(namespaceName, typeName);
    if (resolved === undefined) return undefined;
    if (resolved.kind !== "interface") return undefined;
    return { namespace: resolved.namespace, value: resolved.value };
};

/**
 * Per-widget prop names whose generated emission is suppressed because a
 * compound child component supplies the data declaratively instead of the raw
 * GObject property (e.g. `columns` on `GtkColumnView`, supplied through
 * `<GtkColumnViewColumn>`). Suppressing the generated prop keeps the raw
 * GObject model off a surface that takes the data as children.
 *
 * Entries are matched against the widget's GLib type name (e.g.
 * `"GtkColumnView"`); values are the JS prop names to skip. Array props are
 * suppressed separately, through `arrayPropNames`.
 */
const PROP_OVERRIDES_BY_WIDGET: Readonly<Record<string, ReadonlySet<string>>> = {
    GtkColumnView: new Set(["columns"]),
};

const isPropOverridden = (ownerName: string, propName: string): boolean => {
    const overrides = PROP_OVERRIDES_BY_WIDGET[ownerName];
    return overrides?.has(propName) ?? false;
};

const renderSignalHandler = (options: SignalRenderOptions): string => {
    const { types, signal, selfType, owningNamespace } = options;
    const visible = signal.parameters.filter((parameter) => !parameter.isVarargs);
    const params = [
        ...renderHandlerParameters(signal.parameters, owningNamespace, (ref, nullable) =>
            renderReactPropType(types, ref, nullable),
        ),
        `self: ${selfType}`,
    ];
    return `(${params.join(", ")}) => ${renderSignalReturnType(options, visible)}`;
};

/**
 * Computes a signal handler's return type.
 *
 * Pure out-parameters (`direction="out"`, not caller-allocated) are surfaced
 * through the return value as a tuple `[primary, ...outs]`, mirroring the
 * convention {@link renderMethodReturnType} produces for methods: a value return
 * with no outs stays scalar (unioned with `undefined` so handlers may opt out); a
 * void return with a single out unwraps to that out's type; otherwise the primary
 * (when present) leads a tuple of the out types.
 *
 * @param options - The signal render options
 * @param visible - The signal's non-varargs parameters
 */
const renderSignalReturnType = (options: SignalRenderOptions, visible: readonly GirParameter[]): string => {
    const { types, signal, owningNamespace } = options;
    const qualifiedReturn = qualifyTypeRef(signal.returnValue.type, owningNamespace);
    const baseReturn = renderReactPropType(types, qualifiedReturn, signal.returnValue.nullable);
    const outTypes = visible
        .filter(
            (parameter) =>
                isOutParameter(parameter) ||
                (isInoutParameter(parameter) && isScalarRef(types.repository, owningNamespace, parameter.type)),
        )
        .map((parameter) => renderReactPropType(types, qualifyTypeRef(parameter.type, owningNamespace), false));
    if (outTypes.length === 0) {
        return baseReturn === "void" ? "void" : `${baseReturn} | undefined`;
    }
    if (baseReturn !== "void") {
        return `[${baseReturn}, ${outTypes.join(", ")}]`;
    }
    const [single, ...rest] = outTypes;
    if (rest.length === 0 && single !== undefined) return single;
    return `[${outTypes.join(", ")}]`;
};

const reactTarget = (context: PropTypeRenderContext): TsTypeTarget => ({
    containerStyle: "record",
    callbackType: "(...args: unknown[]) => unknown",
    byteArrayAsNumber: false,
    renderNamed: (ref) => namedTsType(context, ref),
});

const renderReactPropType = (
    context: PropTypeRenderContext,
    ref: GirTypeRef | undefined,
    isNullable: boolean,
): string => {
    const base = renderBaseTypeFor(reactTarget(context), ref);
    return isNullable ? `${base} | null` : base;
};

const namedTsType = (context: PropTypeRenderContext, ref: NamedTypeRef): string => {
    const namespaceName = ref.namespaceName;
    if (namespaceName === undefined) {
        return ref.typeName;
    }
    const resolved = context.repository.resolveNamed(namespaceName, ref.typeName);
    if (resolved === undefined) {
        context.imports.set(namespaceName, namespaceName);
        return `${namespaceName}.${ref.typeName}`;
    }
    if (resolved.kind === "callback") return "(...args: unknown[]) => unknown";
    if (resolved.kind === "alias") {
        if (context.bigintAliases.has(`${namespaceName}.${ref.typeName}`)) return "bigint";
        if (resolved.target === undefined) return "number";
        return namedTsType(context, {
            kind: "named",
            namespaceName: resolved.namespace.name,
            typeName: resolved.target,
            cType: undefined,
        });
    }
    context.imports.set(namespaceName, namespaceName);
    return `${namespaceName}.${ref.typeName}`;
};
