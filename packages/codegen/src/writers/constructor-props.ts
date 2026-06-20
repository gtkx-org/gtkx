import { dedupeBy, quote, toCamelIdentifier, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent, renderBlock, renderBraced } from "../dsl/emit.js";
import { ancestorChain } from "../gir/ancestry.js";
import type { GirClass } from "../gir/class.js";
import { type GirProperty, isConstructableProperty } from "../gir/property.js";
import { splitOptionalNamespace } from "../gir/type-ref.js";
import { collectInterfaceProperties } from "./inheritance.js";
import { renderTsType } from "./ts-type.js";
import { renderFfiType } from "./value.js";

/**
 * The camelCase names of every constructable property an ancestor class
 * introduces. A GIR class may redeclare an inherited property (e.g. an Adwaita
 * page redeclares `GtkWidget`'s `name`); since each constructor translates its
 * props to `[ffiType, value]` instructions and forwards `...rest` to `super`,
 * translating a redeclared property here would wrap it a second time when the
 * introducing ancestor's constructor translates it again. Excluding these names
 * forwards such props up untouched to the single ancestor that owns them.
 *
 * @param context - The module context
 * @param klass - The class whose ancestors to scan
 */
const ancestorConstructablePropNames = (context: ModuleContext, klass: GirClass): ReadonlySet<string> => {
    const names = new Set<string>();
    for (const { klass: ancestor } of ancestorChain(context.repository, klass, context.namespace.name)) {
        if (ancestor === klass) continue;
        for (const property of ancestor.properties) {
            if (isConstructableProperty(property)) names.add(toCamelIdentifier(property.name));
        }
    }
    return names;
};

/**
 * The constructable properties a class introduces: its own writable/construct
 * properties plus those it inherits from directly-implemented interfaces,
 * deduplicated by camelCase JS name (the class's own declaration wins).
 *
 * Ancestor class properties are excluded — including any the class redeclares —
 * so each class translates only the props it introduces and forwards the rest
 * up the `super(...)` chain.
 *
 * @param context - The module context
 * @param klass - The class whose construct props to collect
 */
const collectConstructableProps = (context: ModuleContext, klass: GirClass): readonly GirProperty[] => {
    const inherited = ancestorConstructablePropNames(context, klass);
    return dedupeBy(
        [...klass.properties, ...collectInterfaceProperties(context, klass)]
            .filter(isConstructableProperty)
            .filter((property) => !inherited.has(toCamelIdentifier(property.name))),
        (property) => toCamelIdentifier(property.name),
    );
};

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
    return renderBlock(`constructor(props: ${PROPS_RECORD} = {})`, body);
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
