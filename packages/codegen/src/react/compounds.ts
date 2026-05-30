import { indent, quote } from "../dsl/emit.js";
import type { GirRepository } from "../gir/repository.js";
import { containerSlotsFor, virtualSubcomponentsFor } from "./compounds-meta.js";
import { mergeSlotProps } from "./slot-props.js";
import { ancestorGlibNames, isWidgetClass, iterateClassesWithGlibName, type WidgetCandidate } from "./widgets.js";

type CompoundAccumulator = {
    readonly elementNames: Set<string>;
    readonly compoundPropTypes: Set<string>;
    readonly virtualPropTypes: Set<string>;
};

/**
 * Generates `compounds.tsx` source — one statically-compiled React
 * component per widget that has slot props, container-slot props, or
 * virtual-child sub-components.
 *
 * Each component is plain JSX: it destructures its slot and container-slot
 * props, forwards the rest to the host intrinsic, and wraps each non-null
 * slot value in a `<Slot>` (setter) or `<ContainerSlot>` (append) element.
 * Virtual-child sub-components (e.g. `GtkStack.Page`) are attached with
 * `Object.assign` under an explicit intersection type so isolated
 * declaration emit succeeds.
 *
 * A host intrinsic is referenced through a module-local
 * `${Name}Element = "Name"` const so the JSX tag does not collide with the
 * exported component of the same name. Widgets with no slots, container
 * slots, or virtual children remain bare string-constant intrinsics in
 * `jsx.ts`.
 *
 * @param repository - The loaded GIR repository
 * @param userSlotProps - User-supplied slot-prop overrides
 */
export const generateCompounds = (
    repository: GirRepository,
    userSlotProps: Readonly<Record<string, readonly string[]>> | undefined,
): { readonly source: string; readonly exportedNames: ReadonlySet<string> } => {
    const slotPropMap = mergeSlotProps(userSlotProps);
    const exportedNames = new Set<string>();
    const exportLines: string[] = [];
    const accumulator: CompoundAccumulator = {
        elementNames: new Set<string>(),
        compoundPropTypes: new Set<string>(),
        virtualPropTypes: new Set<string>(),
    };

    for (const { glibName, klass, namespace } of collectCompoundCandidates(repository)) {
        const slots = resolveInheritedSlots(slotPropMap, klass, namespace, repository);
        const containers = containerSlotsFor(glibName);
        const virtuals = virtualSubcomponentsFor(glibName);
        if (slots.length === 0 && containers.length === 0 && virtuals.length === 0) continue;

        exportLines.push(renderCompound({ glibName, slots, containers, virtuals }, accumulator));
        exportedNames.add(glibName);
    }

    const sections = [
        buildImportLines(accumulator).join("\n"),
        buildElementConsts(accumulator),
        exportLines.join("\n\n"),
    ];
    const source = `${sections.filter((section) => section.length > 0).join("\n\n")}\n`;
    return { source, exportedNames };
};

type CompoundShape = {
    readonly glibName: string;
    readonly slots: readonly string[];
    readonly containers: readonly string[];
    readonly virtuals: ReadonlyArray<{ readonly child: string; readonly intrinsic: string }>;
};

const renderCompound = (shape: CompoundShape, accumulator: CompoundAccumulator): string => {
    const { glibName, slots, containers, virtuals } = shape;
    const propsType = `${glibName}Props`;
    accumulator.compoundPropTypes.add(propsType);
    accumulator.elementNames.add(glibName);
    if (slots.length > 0) accumulator.elementNames.add("Slot");
    if (containers.length > 0) accumulator.elementNames.add("ContainerSlot");

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
        ...slots.map((slot) => renderSlotChild("SlotElement", slot)),
        ...containers.map((container) => renderSlotChild("ContainerSlotElement", container)),
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

const renderSlotChild = (elementConst: string, slot: string): string =>
    `{${slot} != null && <${elementConst} id=${quote(slot)}>{${slot}}</${elementConst}>}`;

const renderVirtualSubcomponent = (
    virtual: { readonly child: string; readonly intrinsic: string },
    accumulator: CompoundAccumulator,
): { readonly field: string; readonly impl: string } => {
    const { child, intrinsic } = virtual;
    const propsType = `${intrinsic}Props`;
    accumulator.virtualPropTypes.add(propsType);
    accumulator.elementNames.add(intrinsic);
    return {
        field: `${child}: (props: ${propsType}) => ReactNode`,
        impl: `${child}: (props: ${propsType}): ReactNode => <${intrinsic}Element {...props} />`,
    };
};

const buildElementConsts = (accumulator: CompoundAccumulator): string =>
    [...accumulator.elementNames]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => `const ${name}Element = ${quote(name)} as const;`)
        .join("\n");

const buildImportLines = (accumulator: CompoundAccumulator): readonly string[] => {
    const lines = ['import type { ReactNode } from "react";'];
    const compoundPropTypes = [...accumulator.compoundPropTypes].sort((a, b) => a.localeCompare(b));
    if (compoundPropTypes.length > 0) {
        lines.push(`import type { ${compoundPropTypes.join(", ")} } from "./jsx.js";`);
    }
    const virtualPropTypes = [...accumulator.virtualPropTypes].sort((a, b) => a.localeCompare(b));
    if (virtualPropTypes.length > 0) {
        lines.push(`import type { ${virtualPropTypes.join(", ")} } from "../jsx.js";`);
    }
    return lines;
};

const resolveInheritedSlots = (
    slotPropMap: Readonly<Record<string, readonly string[]>>,
    klass: WidgetCandidate["klass"],
    namespace: WidgetCandidate["namespace"],
    repository: GirRepository,
): readonly string[] => {
    const seen = new Set<string>();
    const slots: string[] = [];
    for (const glibName of ancestorGlibNames(klass, namespace, repository)) {
        for (const slot of slotPropMap[glibName] ?? []) {
            if (seen.has(slot)) continue;
            seen.add(slot);
            slots.push(slot);
        }
    }
    return slots;
};

const collectCompoundCandidates = (repository: GirRepository): readonly WidgetCandidate[] => {
    const seen = new Set<string>();
    const candidates: WidgetCandidate[] = [];
    for (const candidate of iterateClassesWithGlibName(repository)) {
        const { glibName, klass, namespace } = candidate;
        const isWidget = isWidgetClass(klass, namespace, repository);
        const hasContainerSlot = containerSlotsFor(glibName).length > 0;
        const hasVirtualChild = virtualSubcomponentsFor(glibName).length > 0;
        if (!isWidget && !hasContainerSlot && !hasVirtualChild) continue;
        if (seen.has(glibName)) continue;
        seen.add(glibName);
        candidates.push(candidate);
    }
    return candidates.sort((a, b) => a.glibName.localeCompare(b.glibName));
};
