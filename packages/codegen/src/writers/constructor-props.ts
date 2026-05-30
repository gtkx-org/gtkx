import type { ModuleContext } from "../dsl/context.js";
import { indent, quote } from "../dsl/emit.js";
import { camelCase, pascalCase } from "../dsl/identifier.js";
import type { GirClass } from "../gir/class.js";
import type { GirProperty } from "../gir/property.js";
import { splitQualifiedName } from "../gir/qualified-name.js";
import { collectInterfaceProperties } from "./inheritance.js";
import { writeTsType } from "./types-ts.js";
import { writeFfiType } from "./value.js";

/**
 * Whether a property can be passed to a constructor: writable, construct, or
 * construct-only properties only. Read-only properties cannot be set through
 * `g_object_new_with_properties`.
 *
 * @param property - The GIR property
 */
export const isConstructable = (property: GirProperty): boolean =>
    property.writable || property.construct || property.constructOnly;

/**
 * The constructable properties a class introduces: its own writable/construct
 * properties plus those it inherits from directly-implemented interfaces,
 * deduplicated by camelCase JS name (the class's own declaration wins).
 *
 * Ancestor class properties are intentionally excluded — each class translates
 * only the props it introduces and forwards the rest up the `super(...)` chain.
 *
 * @param ctx - The module context
 * @param klass - The class whose construct props to collect
 */
export const collectConstructableProps = (ctx: ModuleContext, klass: GirClass): readonly GirProperty[] => {
    const all = [...klass.properties, ...collectInterfaceProperties(ctx, klass)].filter(isConstructable);
    const seen = new Set<string>();
    const result: GirProperty[] = [];
    for (const property of all) {
        const jsName = camelCase(property.name);
        if (seen.has(jsName)) continue;
        seen.add(jsName);
        result.push(property);
    }
    return result;
};

/**
 * Renders the `export interface <Class>ConstructorProps` declaration.
 *
 * Each interface lists the camelCase, optional, nullable form of every
 * property the class introduces and `extends` its parent's interface, so the
 * full inherited prop set is available when typing `new <Class>(props)`.
 *
 * @param ctx - The module context
 * @param klass - The class to render props for
 * @param className - The local PascalCase class name
 */
export const renderConstructorPropsInterface = (ctx: ModuleContext, klass: GirClass, className: string): string => {
    const parentRef = resolveParentPropsReference(ctx, klass);
    const extendsClause = parentRef === undefined ? "" : ` extends ${parentRef}`;
    const lines = collectConstructableProps(ctx, klass).map(
        (property) => `${camelCase(property.name)}?: ${writeTsType(ctx, property.type, true)};`,
    );
    const body = lines.length === 0 ? "" : `\n${indent(lines.join("\n"), 1)}\n`;
    return `export interface ${className}ConstructorProps${extendsClause} {${body}}`;
};

/**
 * Renders the constructor for a class, or `undefined` when none is needed.
 *
 * The parentless root of a GObject hierarchy gets the canonical base
 * constructor that hands the assembled `GValue` record to
 * `constructGObjectInstance`. A class that introduces constructable props gets
 * a constructor that destructures and translates those props into `GValue`s,
 * spreads the untranslated remainder, and forwards everything to `super`. A
 * class that introduces no props gets no constructor and inherits its nearest
 * typed ancestor's, keeping the chain free of redundant hops.
 *
 * @param ctx - The module context
 * @param klass - The class being emitted
 * @param className - The local PascalCase class name
 * @param hasParent - Whether the class declares an `extends` clause
 */
export const renderClassConstructor = (
    ctx: ModuleContext,
    klass: GirClass,
    className: string,
    hasParent: boolean,
): string | undefined => {
    if (!hasParent) return renderRootConstructor(ctx);
    const props = collectConstructableProps(ctx, klass);
    if (props.length === 0) return undefined;
    return renderTranslatingConstructor(ctx, props, className);
};

const renderRootConstructor = (ctx: ModuleContext): string => {
    ctx.addConstructGObjectInstanceImport();
    const valueRef = ctx.namespace.name === "GObject" ? "Value" : `${ctx.addCrossNamespaceImport("GObject")}.Value`;
    const body = "constructGObjectInstance(this, props);";
    return `constructor(props: Record<string, ${valueRef} | undefined> = {}) {\n${indent(body, 1)}\n}`;
};

const renderTranslatingConstructor = (ctx: ModuleContext, props: readonly GirProperty[], className: string): string => {
    ctx.addValueFromFfiOptionalImport();
    const destructured = props.map((property) => camelCase(property.name));
    const pattern = `{ ${[...destructured, "...rest"].join(", ")} }`;
    const entries = props.map(
        (property) =>
            `${quote(property.name)}: valueFromFfiOptional(${writeFfiType(ctx, property.type, property.transferOwnership)}, ${camelCase(property.name)}),`,
    );
    const superArg = `{\n${indent([...entries, "...rest,"].join("\n"), 1)}\n}`;
    const body = `super(${superArg});`;
    return `constructor(${pattern}: ${className}ConstructorProps = {}) {\n${indent(body, 1)}\n}`;
};

const resolveParentPropsReference = (ctx: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.parent === undefined) return undefined;
    const { namespaceName, typeName } = splitQualifiedName(klass.parent, ctx.namespace.name);
    const propsName = `${pascalCase(typeName)}ConstructorProps`;
    if (namespaceName === ctx.namespace.name) return propsName;
    const alias = ctx.addCrossNamespaceImport(namespaceName);
    return `${alias}.${propsName}`;
};
