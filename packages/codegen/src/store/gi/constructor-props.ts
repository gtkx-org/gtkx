import { sourceStringLiteral, toCamelIdentifier, toPascalCase, uniqBy } from "@gtkx/utils";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { collectInterfaceProperties } from "../../analysis/inheritance.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { ancestorChain } from "../../gir/ancestry.js";
import type { GirClass } from "../../gir/class.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import { splitOptionalNamespace } from "../../gir/type-ref.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderBlock, renderBraced, renderBracedOrEmpty } from "../../writer/emit.js";

const ancestorConstructablePropNames = (context: ModuleContext, klass: GirClass): Set<string> => {
    const names = new Set<string>();
    for (const { klass: ancestor } of ancestorChain(context.library, klass, context.namespace.name)) {
        if (ancestor === klass) continue;
        for (const property of ancestor.properties) {
            if (isConstructableProperty(property)) names.add(toCamelIdentifier(property.name));
        }
    }
    return names;
};

const collectConstructableProps = (context: ModuleContext, klass: GirClass): GirProperty[] => {
    const inherited = ancestorConstructablePropNames(context, klass);
    return uniqBy(
        [...klass.properties, ...collectInterfaceProperties(context, klass)]
            .filter(isConstructableProperty)
            .filter((property) => !inherited.has(toCamelIdentifier(property.name))),
        (property) => toCamelIdentifier(property.name),
    );
};

export const renderConstructorPropsInterface = (context: ModuleContext, klass: GirClass, className: string): string => {
    const parentRef = resolveParentPropsReference(context, klass);
    const extendsClause = parentRef === undefined ? "" : ` extends ${parentRef}`;
    const lines = collectConstructableProps(context, klass).map(
        (property) =>
            `${toCamelIdentifier(property.name)}?: ${renderTsType(context, property.type, true)} | undefined;`,
    );
    return renderBracedOrEmpty(`export interface ${className}ConstructorProps${extendsClause}`, lines.join("\n"));
};

export const renderClassConstructor = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
    hasParent: boolean,
): string | undefined => {
    if (!hasParent) return renderRootConstructor(context);
    const props = collectConstructableProps(context, klass);
    if (props.length === 0) return undefined;
    return renderTranslatingConstructor(context, props, className);
};

const PROPS_RECORD = "Record<string, unknown>";

const renderRootConstructor = (context: ModuleContext): string => {
    context.addRuntimeImport("getInstanceType");
    context.addRuntimeImport("newObjectWithProperties");
    context.addRuntimeImport("setHandle");
    context.addNativeImport("setWrapper");
    const body = [
        "const handle = newObjectWithProperties(getInstanceType(this), props);",
        "setHandle(this, handle);",
        "setWrapper(handle, this);",
    ].join("\n");
    return renderBlock(`constructor(props: ${PROPS_RECORD} = {})`, body);
};

const renderTranslatingConstructor = (context: ModuleContext, props: GirProperty[], className: string): string => {
    context.addRuntimeImport("t");
    const destructured = props.map((property) => toCamelIdentifier(property.name));
    const pattern = `{ ${[...destructured, "...rest"].join(", ")} }`;
    const entries = props.map(
        (property) =>
            `${sourceStringLiteral(property.name)}: [${renderDescriptor(context, property.type, property.transferOwnership)}, ${toCamelIdentifier(property.name)}],`,
    );
    const recordLiteral = renderBraced(entries.join("\n"));
    const lines = [`const props: ${PROPS_RECORD} = ${recordLiteral};`, "super({ ...props, ...rest });"];
    const body = lines.join("\n");
    return renderBlock(`constructor(${pattern}: ${className}ConstructorProps = {})`, body);
};

const resolveParentPropsReference = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.parent === undefined) return undefined;
    const [parentNamespace, typeName] = splitOptionalNamespace(klass.parent);
    const namespaceName = parentNamespace ?? context.namespace.name;
    const propsName = `${toPascalCase(typeName)}ConstructorProps`;
    if (namespaceName === context.namespace.name) return propsName;
    const alias = context.addCrossNamespaceImport(namespaceName);
    return `${alias}.${propsName}`;
};
