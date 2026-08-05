import type { GirClass } from "../../gir/class.js";
import type { ModuleContext } from "../../writer/context.js";
import { collectInterfaceProperties } from "../../analysis/inheritance.js";
import { renderBracedOrEmpty } from "../../writer/emit.js";
import { parentCompanionRef } from "./companion.js";
import { propertyDoc, type ResolvedAccessor, resolveOwnerAccessor } from "./property-accessor.js";

const PROPERTIES_SUFFIX = "Properties";

const propertyEntry = (accessor: ResolvedAccessor): string =>
    `${propertyDoc(accessor.property)}${accessor.jsName}: ${accessor.tsType};`;

const interfaceEntries = (context: ModuleContext, klass: GirClass): string[] => {
    const entries: string[] = [];

    for (const { owner, property } of collectInterfaceProperties(context, klass)) {
        const accessor = resolveOwnerAccessor(context, property, owner.methods);

        if (!accessor?.hasGetter) {
            continue;
        }

        entries.push(propertyEntry(accessor));
    }

    return entries;
};

const renderPropertyDeclarations = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
    accessors: ResolvedAccessor[],
): string[] => {
    const parentRef = parentCompanionRef(context, klass, PROPERTIES_SUFFIX);
    const extendsClause = parentRef === undefined ? "" : ` extends ${parentRef}`;

    const entries = [
        ...accessors.filter((accessor) => accessor.hasGetter).map((accessor) => propertyEntry(accessor)),
        ...interfaceEntries(context, klass),
    ];

    const map = `${className}${PROPERTIES_SUFFIX}`;

    return [
        renderBracedOrEmpty(`export interface ${map}${extendsClause}`, entries.join("\n")),
        renderBracedOrEmpty(`export interface ${className}`, `__properties__: ${map};`),
    ];
};

export { renderPropertyDeclarations };
