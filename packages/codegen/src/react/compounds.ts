import type { GirRepository } from "../gir/repository.js";
import { containerSlotsFor, virtualSubcomponentsFor } from "./compounds-meta.js";
import { mergeSlotProps } from "./slot-props.js";
import { ancestorGlibNames, isWidgetClass, iterateClassesWithGlibName, type WidgetCandidate } from "./widgets.js";

/**
 * Generates `compounds.ts` source — `createSlotWidget(...)` /
 * `createContainerSlotChild(...)` exports for every widget that has slot
 * props or container-slot sub-components.
 *
 * Widgets with neither slot props nor container-slot children are not
 * emitted here; they remain as bare string-constant intrinsics in
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
    const usedPropTypes = new Set<string>();
    const candidates = collectCompoundCandidates(repository);

    for (const { glibName, klass, namespace } of candidates) {
        const slots = resolveInheritedSlots(slotPropMap, klass, namespace, repository);
        const containers = containerSlotsFor(glibName);
        const virtuals = virtualSubcomponentsFor(glibName);
        if (slots.length === 0 && containers.length === 0 && virtuals.length === 0) continue;
        const propsType = `${glibName}Props`;
        usedPropTypes.add(propsType);
        const slotArg = JSON.stringify([...slots]);
        const slotWidget = `createSlotWidget<${propsType}>("${glibName}", ${slotArg})`;
        const componentType = `(props: ${propsType}) => ReactNode`;

        if (containers.length === 0 && virtuals.length === 0) {
            exportLines.push(`export const ${glibName}: ${componentType} = ${slotWidget};`);
            exportedNames.add(glibName);
            continue;
        }
        const containerEntries = containers
            .map((entry) => `    ${entry.child}: createContainerSlotChild("${entry.slot}"),`)
            .join("\n");
        const virtualEntries = virtuals
            .map((entry) => `    ${entry.child}: createVirtualChild("${entry.intrinsic}"),`)
            .join("\n");
        const allEntries = [containerEntries, virtualEntries].filter((s) => s.length > 0).join("\n");
        const containerFields = containers.map((entry) => `${entry.child}: ContainerSlotChild`);
        const virtualFields = virtuals.map(
            (entry) => `${entry.child}: (props: Record<string, unknown> & { children?: ReactNode }) => ReactNode`,
        );
        const allFields = [...containerFields, ...virtualFields].join("; ");
        exportLines.push(
            `export const ${glibName}: (${componentType}) & { ${allFields} } = Object.assign(${slotWidget}, {\n${allEntries}\n});`,
        );
        exportedNames.add(glibName);
    }

    const sortedPropTypes = [...usedPropTypes].sort((a, b) => a.localeCompare(b));
    const importLines: string[] = [
        'import type { ReactNode } from "react";',
        'import { type ContainerSlotChild, createContainerSlotChild, createVirtualChild } from "../components/compound.js";',
        'import { createSlotWidget } from "../components/slot-widget.js";',
    ];
    if (sortedPropTypes.length > 0) {
        importLines.push(`import type { ${sortedPropTypes.join(", ")} } from "./jsx.js";`);
    }
    const source = `${[...importLines, "", ...exportLines].join("\n")}\n`;
    return { source, exportedNames };
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
