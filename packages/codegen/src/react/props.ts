import { toCamelIdentifier, toUpperFirst } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import { type GirParameter, isInoutParameter, isOutParameter } from "../gir/parameter.js";
import type { GirProperty } from "../gir/property.js";
import type { GirRepository } from "../gir/repository.js";
import type { GirSignal } from "../gir/signal.js";
import type { TypeId } from "../gir/type-id.js";
import { forEachAncestor, type ResolvedInterface, resolveDirectInterfaces } from "../writers/inheritance.js";
import { renderHandlerParameters } from "../writers/param-classify.js";
import { renderBaseTypeFor, type TsTypeTarget } from "../writers/ts-type.js";
import { isScalarRef } from "../writers/value.js";
import { classExposesMethod, isReactNodeClass, signalHandlerName } from "./widgets.js";

/**
 * Rendered prop entries for a single widget's Props interface, together
 * with imports the writer must request to keep type references valid.
 */
export type WidgetPropsEntries = {
    /** Rendered prop lines, indented one level inside the interface body. */
    readonly propLines: readonly string[];
    /** Cross-namespace imports the writer must add to the surrounding module. */
    readonly imports: ReadonlyMap<string, string>;
    /**
     * The widget's own GObject-class properties widened to also accept a
     * `ReactElement`, in declaration order. The reconciler routes these slots
     * by value at runtime (a JSX element mounts as a subtree, an instance is
     * set directly), so this list only drives the `ReactElement` import; no
     * runtime slot table is emitted.
     */
    readonly slotPropNames: readonly string[];
};

/**
 * Options for {@link buildWidgetPropsEntries}.
 */
export type WidgetPropsOptions = {
    /** The full GIR repository. */
    readonly repository: GirRepository;
    /** The widget class whose props bag is being built. */
    readonly klass: GirClass;
    /** The namespace the widget class lives in, for ancestry method probes. */
    readonly namespace: GirNamespace;
    /** Property names whose raw GObject emission is suppressed in favor of a data-prop surface (array, object, or virtual rows). */
    readonly dataPropNames?: ReadonlySet<string>;
    /** Returns `true` when `candidate` already has its own widget Props interface. */
    readonly isWidgetAncestor?: (candidate: GirClass) => boolean;
};

/**
 * Everything the prop-type renderers need beyond the type reference itself:
 * the repository for named-type resolution and the import accumulator the
 * rendering populates.
 */
type PropTypeRenderContext = {
    readonly repository: GirRepository;
    readonly imports: Map<string, string>;
};

type SignalRenderOptions = {
    readonly types: PropTypeRenderContext;
    readonly signal: GirSignal;
    readonly selfType: string;
};

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
    const { repository, klass, namespace, dataPropNames = new Set<string>(), isWidgetAncestor = () => false } = options;
    const imports = new Map<string, string>();
    const types: PropTypeRenderContext = { repository, imports };
    const propEntries: string[] = [];
    const slotPropNames: string[] = [];
    const seen = new Set<string>();

    const ownerName = klass.glibTypeName ?? klass.cType ?? klass.name;

    const acceptProperty = (property: GirProperty): void => {
        if (!property.introspectable) return;
        const jsName = toCamelIdentifier(property.name);
        if (seen.has(jsName)) return;
        seen.add(jsName);
        if (isPropOverridden(ownerName, jsName)) return;
        if (dataPropNames.has(jsName)) return;
        const tsType = renderReactPropType(types, property.type, false);
        if (isSlotProperty({ repository, klass, namespace }, property, jsName)) {
            propEntries.push(`${jsName}?: ${tsType} | ReactElement | null;`);
            slotPropNames.push(jsName);
            return;
        }
        if (isSettableProperty(property)) propEntries.push(`${jsName}?: ${tsType} | null;`);
        propEntries.push(`onNotify${toUpperFirst(jsName)}?: ((value: ${tsType} | null, self: Self) => void) | null;`);
    };

    const acceptSignal = (signal: GirSignal): void => {
        const handlerName = signalHandlerName(signal.name);
        if (seen.has(handlerName)) return;
        seen.add(handlerName);
        const signature = renderSignalHandler({ types, signal, selfType: "Self" });
        propEntries.push(`${handlerName}?: ${signature};`);
    };

    walkWidgetMembers({ repository, klass, namespace, isWidgetAncestor, acceptProperty, acceptSignal });

    return { propLines: propEntries, imports, slotPropNames };
};

/** The widget plus the member visitor {@link walkWidgetMembers} drives. */
type WidgetMemberWalk = {
    readonly repository: GirRepository;
    readonly klass: GirClass;
    readonly namespace: GirNamespace;
    readonly isWidgetAncestor: (candidate: GirClass) => boolean;
    readonly acceptProperty: (property: GirProperty) => void;
    readonly acceptSignal: (signal: GirSignal) => void;
};

/**
 * Visits a widget class, its directly-implemented interfaces, and every
 * non-widget ancestor (nearest first, up to the first widget parent), invoking
 * `acceptProperty`/`acceptSignal` for each member in declaration order.
 */
const walkWidgetMembers = (walk: WidgetMemberWalk): void => {
    const { repository, klass, namespace, isWidgetAncestor, acceptProperty, acceptSignal } = walk;
    const visitMembers = (memberClass: GirClass, interfaces: readonly ResolvedInterface[]): void => {
        for (const property of memberClass.properties) acceptProperty(property);
        for (const signal of memberClass.signals) acceptSignal(signal);
        for (const iface of interfaces) {
            for (const property of iface.klass.properties) acceptProperty(property);
            for (const signal of iface.klass.signals) acceptSignal(signal);
        }
    };
    const ancestry = { repository, namespace };
    visitMembers(klass, resolveDirectInterfaces(ancestry, klass, namespace.name));
    forEachAncestor(
        ancestry,
        klass,
        (ancestor, interfaces) => visitMembers(ancestor.klass, interfaces),
        isWidgetAncestor,
    );
};

/**
 * Whether `ref` names a class that descends from `GObject.Object` (so it is a
 * valid JSX intrinsic the reconciler can mount). Interfaces, boxed/record
 * types, aliases, and primitives all resolve to `false` — only an instantiable
 * GObject class is renderable as a slot subtree.
 *
 * @param repository - The loaded GIR repository
 * @param ref - The property's interned type slot
 */
const resolvesToGobjectClass = (repository: GirRepository, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return false;
    const resolved = repository.typeOf(ref);
    if (resolved?.kind !== "class") return false;
    return isReactNodeClass(resolved.value, resolved.namespace, repository);
};

/**
 * Whether `property` can be assigned through the React prop surface. A
 * `writable`, `construct`, or `construct-only` property reaches its GObject
 * through the accessor setter or the construction GValue record; a read-only
 * property (a getter with no setter, e.g. `GtkWidget:parent`) cannot, so it is
 * omitted from the settable surface and exposed only through its generated
 * `onNotify<Prop>` change handler.
 *
 * @param property - The GIR property to classify.
 */
const isSettableProperty = (property: GirProperty): boolean =>
    property.writable || property.construct || property.constructOnly;

/** The widget being emitted, supplying ancestry lookups for slot eligibility. */
type SlotOwner = {
    /** The loaded GIR repository. */
    readonly repository: GirRepository;
    /** The widget class whose Props bag is being built. */
    readonly klass: GirClass;
    /** The namespace `klass` lives in. */
    readonly namespace: GirNamespace;
};

/**
 * Whether `property` is exposed as a renderable slot: a settable
 * (writable, non-construct-only) property whose value is a GObject class,
 * widened to `Class | ReactElement | null` so app code can mount a JSX subtree
 * or pass an instance.
 *
 * The single-child `child` property is excluded — single-child containers
 * already mount their one child by nesting it (the reconciler's
 * `isSingleChildContainer` fallback, recognized here by the `set_child`
 * method), so widening it would mint a redundant second way to set the child.
 *
 * @param owner - The widget being emitted
 * @param property - The candidate property
 * @param jsName - The property's camelCase JS name
 */
const isSlotProperty = (owner: SlotOwner, property: GirProperty, jsName: string): boolean => {
    if (!property.writable || property.constructOnly) return false;
    if (!resolvesToGobjectClass(owner.repository, property.type)) return false;
    if (jsName === "child" && classExposesMethod(owner.klass, owner.namespace, owner.repository, "set_child")) {
        return false;
    }
    return true;
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
    const { types, signal, selfType } = options;
    const visible = signal.parameters.filter((parameter) => !parameter.isVarargs);
    const params = [
        ...renderHandlerParameters(signal.parameters, (ref, nullable) => renderReactPropType(types, ref, nullable)),
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
    const { types, signal } = options;
    const baseReturn = renderReactPropType(types, signal.returnValue.type, signal.returnValue.nullable);
    const outTypes = visible
        .filter(
            (parameter) =>
                isOutParameter(parameter) ||
                (isInoutParameter(parameter) && isScalarRef(types.repository, parameter.type)),
        )
        .map((parameter) => renderReactPropType(types, parameter.type, false));
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
    renderNamed: (resolved, name) => {
        if (resolved?.kind === "callback") return "(...args: unknown[]) => unknown";
        if (resolved?.kind === "alias") {
            return resolved.target === undefined
                ? "number"
                : renderBaseTypeFor(context.repository, reactTarget(context), resolved.target);
        }
        context.imports.set(name.namespaceName, name.namespaceName);
        return `${name.namespaceName}.${name.typeName}`;
    },
    renderGtype: () => {
        context.imports.set("GObject", "GObject");
        return "GObject.GType";
    },
});

const renderReactPropType = (context: PropTypeRenderContext, ref: TypeId | undefined, isNullable: boolean): string => {
    const base = renderBaseTypeFor(context.repository, reactTarget(context), ref);
    return isNullable ? `${base} | null` : base;
};
