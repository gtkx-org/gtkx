import { sourceStringLiteral, toCamelIdentifier, uniqBy } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { collectInterfaceProperties } from "../../analysis/inheritance.js";
import { inputParameters, parameterIdentifier } from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { ancestorChain, resolveInterfaces } from "../../gir/ancestry.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import { renderBlock, renderBraced, renderBracedOrEmpty } from "../../writer/emit.js";
import { type Callables, staticMembers } from "./callables.js";
import { parentCompanionRef } from "./companion.js";
import { propertyDoc } from "./property-accessor.js";

type ClassConstructorSpec = {
    klass: GirClass;
    className: string;
    hasParent: boolean;
    callables: Callables;
};

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

const isFundamentalClass = (context: ModuleContext, klass: GirClass): boolean => {
    for (const { klass: ancestor } of ancestorChain(context.library, klass, context.namespace.name)) {
        if (ancestor.fundamental) {
            return true;
        }
    }

    return false;
};

const isSelfReturning = (context: ModuleContext, klass: GirClass, callable: GirFunction): boolean => {
    const ref = callable.returnValue.type;
    const name = ref === undefined ? undefined : context.library.nameFor(ref);

    return name?.namespaceName === context.namespace.name && name.typeName === klass.name;
};

const constructionHint = (context: ModuleContext, klass: GirClass, callables: Callables): string | undefined => {
    const candidates = staticMembers(context, callables).filter(({ callable }) =>
        isSelfReturning(context, klass, callable));

    const candidate =
        candidates.find(({ name }) => name === "newFull") ??
        candidates.find(({ name }) => name === "new") ??
        candidates[0];

    if (candidate === undefined) {
        return undefined;
    }

    const args = inputParameters(context.library, candidate.callable).map(({ parameter, index }) =>
        parameterIdentifier(parameter, index));

    return `${candidate.name}(${args.join(", ")})`;
};

const fundamentalMessage = (qualified: string, hint: string | undefined): string => {
    const reason = `Cannot construct ${qualified} with new: it is a GType fundamental rather than a GObject`;

    return hint === undefined
        ? `${reason}, so its instances come from the functions that return them.`
        : `${reason}; use ${qualified}.${hint} instead.`;
};

const INITIALIZATION_INTERFACES: Set<string> = new Set(["AsyncInitable", "Initable"]);

const requiresFactoryInitialization = (context: ModuleContext, klass: GirClass): boolean => {
    for (const ancestor of ancestorChain(context.library, klass, context.namespace.name)) {
        const interfaces = resolveInterfaces(
            context.library,
            ancestor.namespaceName,
            ancestor.klass.implements,
        );

        if (interfaces.some((entry) =>
            entry.namespaceName === "Gio" && INITIALIZATION_INTERFACES.has(entry.klass.name))) {
            return true;
        }
    }

    return false;
};

const initializationMessage = (qualified: string, hint: string | undefined): string => {
    const reason = `Cannot construct ${qualified} with new: it requires Gio factory initialization`;

    return hint === undefined
        ? `${reason} through a factory function.`
        : `${reason}; use ${qualified}.${hint} instead.`;
};

const renderInitializationGuard = (context: ModuleContext, spec: ClassConstructorSpec): string => {
    const qualified = `${context.namespace.name}.${spec.className}`;
    const hint = constructionHint(context, spec.klass, spec.callables);
    const message = sourceStringLiteral(initializationMessage(qualified, hint));

    return renderBlock("constructor()", `throw new globalThis.Error(${message});`);
};

const renderFundamentalGuard = (context: ModuleContext, spec: ClassConstructorSpec): string => {
    const qualified = `${context.namespace.name}.${spec.className}`;
    const hint = constructionHint(context, spec.klass, spec.callables);
    const message = sourceStringLiteral(fundamentalMessage(qualified, hint));

    return renderBlock("constructor()", `throw new globalThis.Error(${message});`);
};

const renderClassConstructor = (context: ModuleContext, spec: ClassConstructorSpec): string | undefined => {
    const { klass, className, hasParent } = spec;

    if (isFundamentalClass(context, klass)) {
        return renderFundamentalGuard(context, spec);
    }

    if (requiresFactoryInitialization(context, klass)) {
        return renderInitializationGuard(context, spec);
    }

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
    const body = "return newObjectWithProperties(getClassType(this.constructor as AnyClass), props, this);";

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
    const target = `_${className}`;
    context.collectRegistration(`registerConstructProperties(${target}, ${bindings});`);

    return renderBlock(`constructor(props: ${className}ConstructorProps = {})`, "super(props);");
};

export {
    isFundamentalClass,
    renderConstructorPropsInterface,
    renderClassConstructor,
    requiresFactoryInitialization,
};
