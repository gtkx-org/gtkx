import { quote } from "@gtkx/utils";
import { indent } from "../dsl/emit.js";
import type { GirRepository } from "../gir/repository.js";
import { type VirtualSubcomponent, virtualSubcomponentsFor, wrapperKindForIntrinsic } from "./compounds-meta.js";
import {
    ancestorGlibNames,
    isReactNodeClass,
    isWidgetClass,
    iterateClassesWithGlibName,
    type WidgetCandidate,
} from "./widgets.js";

type CompoundAccumulator = {
    readonly elementNames: Set<string>;
    readonly compoundPropTypes: Set<string>;
    readonly virtualPropTypes: Set<string>;
};

/** The single JSX element name every metadata wrapper renders. */
const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

/**
 * Records that the {@link WRAPPER_NODE_ELEMENT} sentinel const must be emitted.
 *
 * @param accumulator - The shared compound accumulator.
 */
const useWrapperElement = (accumulator: CompoundAccumulator): void => {
    accumulator.elementNames.add(WRAPPER_NODE_ELEMENT);
};

/** Module-local const name binding the wrapper sentinel element. */
const wrapperElementConst = (name: string): string =>
    name === WRAPPER_NODE_ELEMENT ? "WrapperNodeElement" : `${name}Element`;

/**
 * Generates `compounds.tsx` source — one statically-compiled React
 * component per widget that has slot props, container-slot props, or
 * virtual-child sub-components.
 *
 * Each component is plain JSX: it destructures its slot and container-slot
 * props, forwards the rest to the host intrinsic, and wraps each non-null
 * slot value in a `<WrapperNodeElement kind="slot">` (setter, target from
 * `propName`) or `<WrapperNodeElement kind="container-slot">` (append, target
 * from `method`) sentinel element. Virtual-child sub-components (e.g.
 * `GtkStack.Page`) are attached with `Object.assign` under an explicit
 * intersection type so isolated declaration emit succeeds; wrapper-kind virtuals
 * render the same sentinel with their generic kind, while bespoke virtuals (e.g.
 * `TextTag`) keep their own intrinsic.
 *
 * A host or bespoke intrinsic is referenced through a module-local
 * `${Name}Element = "Name"` const so the JSX tag does not collide with the
 * exported component of the same name; the wrapper sentinel binds the single
 * `WrapperNodeElement` const. Widgets with no slots, container slots, or
 * virtual children remain bare string-constant intrinsics in `jsx.ts`.
 *
 * @param repository - The loaded GIR repository
 * @param widgetSlotMap - Merged widget-slot names keyed by JSX element name
 * @param containerSlotMap - Merged container-slot methods keyed by JSX element name
 */
export const generateCompounds = (
    repository: GirRepository,
    widgetSlotMap: Readonly<Record<string, readonly string[]>>,
    containerSlotMap: Readonly<Record<string, readonly string[]>>,
): { readonly source: string; readonly exportedNames: ReadonlySet<string> } => {
    const exportedNames = new Set<string>();
    const exportLines: string[] = [];
    const accumulator: CompoundAccumulator = {
        elementNames: new Set<string>(),
        compoundPropTypes: new Set<string>(),
        virtualPropTypes: new Set<string>(),
    };

    for (const { glibName, klass, namespace } of collectCompoundCandidates(
        repository,
        widgetSlotMap,
        containerSlotMap,
    )) {
        const slots = resolveInheritedSlots(widgetSlotMap, klass, namespace, repository);
        const containers = containerSlotMap[glibName] ?? [];
        const virtuals = virtualSubcomponentsFor(glibName);
        if (slots.length === 0 && containers.length === 0 && virtuals.length === 0) continue;

        exportLines.push(renderCompound({ glibName, slots, containers, virtuals }, accumulator));
        exportedNames.add(glibName);
    }

    const sections = [
        renderImportLines(accumulator).join("\n"),
        renderElementConsts(accumulator),
        exportLines.join("\n\n"),
    ];
    const source = `${sections.filter((section) => section.length > 0).join("\n\n")}\n`;
    return { source, exportedNames };
};

type CompoundShape = {
    readonly glibName: string;
    readonly slots: readonly string[];
    readonly containers: readonly string[];
    readonly virtuals: readonly VirtualSubcomponent[];
};

const renderCompound = (shape: CompoundShape, accumulator: CompoundAccumulator): string => {
    const { glibName, slots, containers, virtuals } = shape;
    const propsType = `${glibName}Props`;
    accumulator.compoundPropTypes.add(propsType);
    accumulator.elementNames.add(glibName);
    if (slots.length > 0 || containers.length > 0) useWrapperElement(accumulator);

    const component = renderComponentFunction(glibName, propsType, slots, containers);
    if (virtuals.length === 0) {
        return `export const ${glibName} = ${component};`;
    }

    const subcomponents = virtuals.map((virtual) => renderVirtualSubcomponent(virtual, accumulator));
    const fields = subcomponents.map((sub) => `    ${sub.field};`).join("\n");
    const impls = subcomponents.map((sub) => indent(`${sub.impl},`, 1)).join("\n");
    return [
        `export const ${glibName}: ((props: ${propsType}) => ReactNode) & {`,
        fields,
        `} = Object.assign(`,
        `${indent(component, 1)},`,
        "    {",
        impls,
        "    },",
        ");",
    ].join("\n");
};

const renderComponentFunction = (
    glibName: string,
    propsType: string,
    slots: readonly string[],
    containers: readonly string[],
): string => {
    const host = `${glibName}Element`;
    if (slots.length === 0 && containers.length === 0) {
        return [
            `(props: ${propsType}): ReactNode => {`,
            "    const { children, ...rest } = props;",
            `    return <${host} {...rest}>{children}</${host}>;`,
            "}",
        ].join("\n");
    }

    const destructured = [...slots, ...containers, "children"].join(", ");
    const slotChildren = [
        ...slots.map((slot) => renderSlotChild("slot", "propName", slot)),
        ...containers.map((container) => renderSlotChild("container-slot", "method", container)),
    ];
    return [
        `(props: ${propsType}): ReactNode => {`,
        `    const { ${destructured}, ...rest } = props;`,
        "    return (",
        `        <${host} {...rest}>`,
        "            {children}",
        ...slotChildren.map((child) => `            ${child}`),
        `        </${host}>`,
        "    );",
        "}",
    ].join("\n");
};

const renderSlotChild = (kind: string, targetProp: string, slot: string): string =>
    `{${slot} != null && <WrapperNodeElement kind=${quote(kind)} ${targetProp}=${quote(slot)}>{${slot}}</WrapperNodeElement>}`;

const renderVirtualSubcomponent = (
    virtual: VirtualSubcomponent,
    accumulator: CompoundAccumulator,
): { readonly field: string; readonly impl: string } => {
    const { child, propsType } = virtual;
    accumulator.virtualPropTypes.add(propsType);
    const impl = renderVirtualImpl(virtual, accumulator);
    return {
        field: `${child}: (props: ${propsType}) => ReactNode`,
        impl: `${child}: (props: ${propsType}): ReactNode => ${impl}`,
    };
};

const renderVirtualImpl = (virtual: VirtualSubcomponent, accumulator: CompoundAccumulator): string => {
    const { intrinsic, renameProps } = virtual;
    const wrapperKind = wrapperKindForIntrinsic(intrinsic);
    if (wrapperKind) {
        useWrapperElement(accumulator);
        return `<WrapperNodeElement kind=${quote(wrapperKind)} {...props} />`;
    }
    accumulator.elementNames.add(intrinsic);
    if (!renameProps) return `<${intrinsic}Element {...props} />`;
    const renames = Object.entries(renameProps);
    const destructured = renames.map(([from]) => from).join(", ");
    const attributes = renames.map(([from, to]) => `${to}={${from}}`).join(" ");
    return `(() => { const { ${destructured}, ...rest } = props; return <${intrinsic}Element ${attributes} {...rest} />; })()`;
};

const renderElementConsts = (accumulator: CompoundAccumulator): string =>
    [...accumulator.elementNames]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => `const ${wrapperElementConst(name)} = ${quote(name)} as const;`)
        .join("\n");

const renderImportLines = (accumulator: CompoundAccumulator): readonly string[] => {
    const lines = ['import type { ReactNode } from "react";'];
    const compoundPropTypes = [...accumulator.compoundPropTypes].sort((a, b) => a.localeCompare(b));
    if (compoundPropTypes.length > 0) {
        lines.push(`import type { ${compoundPropTypes.join(", ")} } from "./jsx.js";`);
    }
    const virtualPropTypes = [...accumulator.virtualPropTypes].sort((a, b) => a.localeCompare(b));
    if (virtualPropTypes.length > 0) {
        lines.push(`import type { ${virtualPropTypes.join(", ")} } from "@gtkx/react";`);
    }
    return lines;
};

const resolveInheritedSlots = (
    widgetSlotMap: Readonly<Record<string, readonly string[]>>,
    klass: WidgetCandidate["klass"],
    namespace: WidgetCandidate["namespace"],
    repository: GirRepository,
): readonly string[] => {
    const seen = new Set<string>();
    const slots: string[] = [];
    for (const glibName of ancestorGlibNames(klass, namespace, repository)) {
        for (const slot of widgetSlotMap[glibName] ?? []) {
            if (seen.has(slot)) continue;
            seen.add(slot);
            slots.push(slot);
        }
    }
    return slots;
};

const collectCompoundCandidates = (
    repository: GirRepository,
    widgetSlotMap: Readonly<Record<string, readonly string[]>>,
    containerSlotMap: Readonly<Record<string, readonly string[]>>,
): readonly WidgetCandidate[] => {
    const seen = new Set<string>();
    const candidates: WidgetCandidate[] = [];
    for (const candidate of iterateClassesWithGlibName(repository)) {
        const { glibName, klass, namespace } = candidate;
        const isWidget = isWidgetClass(klass, namespace, repository);
        const isReactNode = isReactNodeClass(klass, namespace, repository);
        const hasWidgetSlot = isReactNode && (widgetSlotMap[glibName] ?? []).length > 0;
        const hasContainerSlot = isReactNode && (containerSlotMap[glibName] ?? []).length > 0;
        const hasVirtualChild = virtualSubcomponentsFor(glibName).length > 0;
        if (!isWidget && !hasWidgetSlot && !hasContainerSlot && !hasVirtualChild) continue;
        if (seen.has(glibName)) continue;
        seen.add(glibName);
        candidates.push(candidate);
    }
    return candidates.sort((a, b) => a.glibName.localeCompare(b.glibName));
};
