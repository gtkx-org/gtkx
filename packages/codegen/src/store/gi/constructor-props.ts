import { sourceStringLiteral, toCamelIdentifier, uniqBy } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { collectInterfaceProperties } from "../../analysis/inheritance.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { ancestorChain } from "../../gir/ancestry.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import { renderBlock, renderBraced, renderBracedOrEmpty } from "../../writer/emit.js";
import { parentCompanionRef } from "./companion.js";
import { propertyDoc } from "./property-accessor.js";

const constructablePropNames = (klass: GirClass): string[] =>
    klass.properties.filter(isConstructableProperty).map((property) => toCamelIdentifier(property.name));

const ancestorConstructablePropNames = (context: ModuleContext, klass: GirClass): Set<string> => {
    const names: Set<string> = new Set();

    for (const { klass: ancestor } of ancestorChain(context.library, klass, context.namespace.name)) {
        if (ancestor === klass) {
            continue;
        }

        for (const name of constructablePropNames(ancestor)) {
            names.add(name);
        }
    }

    return names;
};

const collectConstructableProps = (context: ModuleContext, klass: GirClass): GirProperty[] => {
    const inherited = ancestorConstructablePropNames(context, klass);

    return uniqBy(
        [...klass.properties, ...collectInterfaceProperties(context, klass).map((entry) => entry.property)]
            .filter(isConstructableProperty)
            .filter((property) => !inherited.has(toCamelIdentifier(property.name))),
        (property) => toCamelIdentifier(property.name),
    );
};

const renderConstructorPropsInterface = (context: ModuleContext, klass: GirClass, className: string): string => {
    const parentRef = parentCompanionRef(context, klass, "ConstructorProps");
    const extendsClause = parentRef === undefined ? "" : ` extends ${parentRef}`;

    const lines = collectConstructableProps(context, klass).map(
        (property) =>
            `${propertyDoc(property)}${toCamelIdentifier(property.name)}?: ` +
            `${renderTsType(context, property.type, true)} | undefined;`,
    );

    return renderBracedOrEmpty(`export interface ${className}ConstructorProps${extendsClause}`, lines.join("\n"));
};

const renderClassConstructor = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
    hasParent: boolean,
): string | undefined => {
    if (!hasParent) {
        return renderRootConstructor(context);
    }

    const props = collectConstructableProps(context, klass);

    if (props.length === 0) {
        return undefined;
    }

    return renderTranslatingConstructor(context, props, className);
};

const renderRootConstructor = (context: ModuleContext): string => {
    context.addRuntimeTypeImport("AnyClass");
    context.addRuntimeImport("getClassType");
    context.addRuntimeImport("newObjectWithProperties");
    const body = "newObjectWithProperties(getClassType(this.constructor as AnyClass), props, this);";

    return renderBlock("constructor(props: object = {})", body);
};

const renderConstructBindings = (context: ModuleContext, props: GirProperty[]): string => {
    const entries = props.map((property) => {
        const descriptor = renderDescriptor(context, property.type, property.transferOwnership);
        const key = sourceStringLiteral(toCamelIdentifier(property.name));

        return `${key}: [${sourceStringLiteral(property.name)}, ${descriptor}],`;
    });

    return renderBraced(entries.join("\n"));
};

const renderTranslatingConstructor = (context: ModuleContext, props: GirProperty[], className: string): string => {
    context.addRuntimeImport("t");
    context.addRuntimeImport("registerConstructProperties");
    const bindings = renderConstructBindings(context, props);
    context.module.appendRegistration(`registerConstructProperties(${className}, ${bindings});`, [className]);

    return renderBlock(`constructor(props: ${className}ConstructorProps = {})`, "super(props);");
};

export { renderConstructorPropsInterface, renderClassConstructor };
