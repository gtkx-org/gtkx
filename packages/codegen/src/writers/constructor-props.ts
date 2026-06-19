import { dedupeBy, quote, toCamelIdentifier, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirClass } from "../gir/class.js";
import type { GirProperty } from "../gir/property.js";
import { splitQualifiedName } from "../gir/qualified-name.js";
import { collectInterfaceProperties } from "./inheritance.js";
import { renderTsType } from "./ts-type.js";
import { renderFfiType } from "./value.js";

/**
 * Whether a property can be passed to a constructor: writable, construct, or
 * construct-only properties only. Read-only properties cannot be set through
 * `g_object_new_with_properties`.
 *
 * @param property - The GIR property
 */
const isConstructable = (property: GirProperty): boolean =>
    property.writable || property.construct || property.constructOnly;

/**
 * The constructable properties a class introduces: its own writable/construct
 * properties plus those it inherits from directly-implemented interfaces,
 * deduplicated by camelCase JS name (the class's own declaration wins).
 *
 * Ancestor class properties are intentionally excluded — each class translates
 * only the props it introduces and forwards the rest up the `super(...)` chain.
 *
 * @param context - The module context
 * @param klass - The class whose construct props to collect
 */
const collectConstructableProps = (context: ModuleContext, klass: GirClass): readonly GirProperty[] =>
    dedupeBy([...klass.properties, ...collectInterfaceProperties(context, klass)].filter(isConstructable), (property) =>
        toCamelIdentifier(property.name),
    );

/**
 * Renders the `export interface <Class>ConstructorProps` declaration.
 *
 * Each interface lists the camelCase, optional, nullable form of every
 * property the class introduces and `extends` its parent's interface, so the
 * full inherited prop set is available when typing `new <Class>(props)`.
 *
 * @param context - The module context
 * @param klass - The class to render props for
 * @param className - The local PascalCase class name
 */
export const renderConstructorPropsInterface = (context: ModuleContext, klass: GirClass, className: string): string => {
    const parentRef = resolveParentPropsReference(context, klass);
    const extendsClause = parentRef === undefined ? "" : ` extends ${parentRef}`;
    const lines = collectConstructableProps(context, klass).map(
        (property) => `${toCamelIdentifier(property.name)}?: ${renderTsType(context, property.type, true)};`,
    );
    const body = lines.length === 0 ? "" : `\n${indent(lines.join("\n"), 1)}\n`;
    return `export interface ${className}ConstructorProps${extendsClause} {${body}}`;
};

/**
 * Renders the constructor for a class, or `undefined` when none is needed.
 *
 * The parentless root of a GObject hierarchy gets the canonical base
 * constructor: it hands the assembled marshalling record to
 * `newGobjectWithProperties` and links the returned handle to the wrapper. A
 * class that introduces constructable props gets
 * a constructor that destructures and translates those props into `GValue`s,
 * spreads the untranslated remainder, and forwards everything to `super`. A
 * class that introduces no props gets no constructor and inherits its nearest
 * typed ancestor's, keeping the chain free of redundant hops.
 *
 * @param context - The module context
 * @param klass - The class being emitted
 * @param className - The local PascalCase class name
 * @param hasParent - Whether the class declares an `extends` clause
 */
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

/**
 * The forwarding record a constructor hands to `super`: each property it
 * introduces as a `[ffiType, value]` marshalling instruction keyed by GIR name,
 * spread alongside the still-raw `...rest` bound for ancestor constructors. The
 * root constructor marshals the instructions; raw `...rest` entries pass through
 * untouched until the ancestor that introduces them.
 */
const PROPS_RECORD = "Record<string, unknown>";

const renderRootConstructor = (context: ModuleContext): string => {
    context.addRuntimeImport("getInstanceGtype");
    context.addRuntimeImport("newGobjectWithProperties");
    context.addRuntimeImport("setHandle");
    context.addNativeImport("setWrapper");
    const body = [
        "const handle = newGobjectWithProperties(getInstanceGtype(this), props);",
        "setHandle(this, handle);",
        "setWrapper(handle, this);",
    ].join("\n");
    return `constructor(props: ${PROPS_RECORD} = {}) {\n${indent(body, 1)}\n}`;
};

const renderTranslatingConstructor = (
    context: ModuleContext,
    props: readonly GirProperty[],
    className: string,
): string => {
    context.addRuntimeImport("t");
    const destructured = props.map((property) => toCamelIdentifier(property.name));
    const pattern = `{ ${[...destructured, "...rest"].join(", ")} }`;
    const entries = props.map(
        (property) =>
            `${quote(property.name)}: [${renderFfiType(context, property.type, property.transferOwnership)}, ${toCamelIdentifier(property.name)}],`,
    );
    const recordLiteral = `{\n${indent(entries.join("\n"), 1)}\n}`;
    const lines = [`const props: ${PROPS_RECORD} = ${recordLiteral};`, "super({ ...props, ...rest });"];
    const body = lines.join("\n");
    return `constructor(${pattern}: ${className}ConstructorProps = {}) {\n${indent(body, 1)}\n}`;
};

const resolveParentPropsReference = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.parent === undefined) return undefined;
    const { namespaceName, typeName } = splitQualifiedName(klass.parent, context.namespace.name);
    const propsName = `${toPascalCase(typeName)}ConstructorProps`;
    if (namespaceName === context.namespace.name) return propsName;
    const alias = context.addCrossNamespaceImport(namespaceName);
    return `${alias}.${propsName}`;
};
