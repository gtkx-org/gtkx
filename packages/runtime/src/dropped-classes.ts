import { createLogger, type Logger } from "@gtkx/utils";
import { TYPE_INVALID, typeName, typeParent } from "./type.js";

type GeneratedNamespace = {
    namespace: string;
    directory: string;
    typeNamePrefix: string;
    classNames: string;
};

type GeneratedClass = {
    namespace: string;
    directory: string;
    className: string;
};

const log: Logger = createLogger("runtime");
const namespaces: GeneratedNamespace[] = [];
const checkedTypes: Set<bigint> = new Set();
const warnedTypes: Set<bigint> = new Set();
let generatedClasses: Map<string, GeneratedClass> | undefined;

/**
 * Records the object classes a generated namespace defines, so a production bundle can name the
 * class tree shaking dropped when an object of that type is wrapped as one of its ancestors.
 * Development and tests load every class, so the call does nothing outside production.
 * @param namespace GIR namespace name, such as `Adw`.
 * @param directory The namespace's `@gtkx/gi` subpath, such as `adw`.
 * @param typeNamePrefix Prefix that turns a class name into its GType name, such as `Adw`.
 * @param classNames Space-separated class names. A class whose GType name does not follow the
 * prefix is written `Name:GTypeName`.
 */
function registerGeneratedClasses(
    namespace: string,
    directory: string,
    typeNamePrefix: string,
    classNames: string,
): void {
    if (process.env.NODE_ENV !== "production") {
        return;
    }

    namespaces.push({ namespace, directory, typeNamePrefix, classNames });
    generatedClasses = undefined;
}

function indexGeneratedClasses(): Map<string, GeneratedClass> {
    const index: Map<string, GeneratedClass> = new Map();

    for (const { namespace, directory, typeNamePrefix, classNames } of namespaces) {
        for (const entry of classNames.split(" ")) {
            const [className = entry, gtypeName = typeNamePrefix + className] = entry.split(":");
            index.set(gtypeName, { namespace, directory, className });
        }
    }

    return index;
}

function generatedClassFor(type: bigint): GeneratedClass | undefined {
    const name = typeName(type);

    if (name === null) {
        return undefined;
    }

    generatedClasses ??= indexGeneratedClasses();

    return generatedClasses.get(name);
}

function warnDroppedClass(type: bigint, dropped: GeneratedClass, baseType: bigint): void {
    const qualified = `${dropped.namespace}.${dropped.className}`;

    log.warn(
        `${typeName(type) ?? qualified} objects reach JavaScript as ${typeName(baseType) ?? "an ancestor"} ` +
            `because the production build dropped ${qualified}, so its methods and properties are missing. ` +
            `Reference the class as a value to keep it, for example with \`instanceof ${qualified}\` after ` +
            `\`import * as ${dropped.namespace} from "@gtkx/gi/${dropped.directory}"\`.`,
    );
}

function nearestRegisteredType(type: bigint, isRegistered: (type: bigint) => boolean): bigint {
    let current = type;

    while (current !== TYPE_INVALID && !isRegistered(current)) {
        current = typeParent(current);
    }

    return current;
}

/**
 * Warns once per class when an object of `runtimeType` reaches JavaScript without a declared type,
 * as through a closure, and the production bundle dropped the generated class of `runtimeType` or of
 * an ancestor more derived than its nearest registered one. Types no generated namespace defines, such
 * as private library classes, are wrapped silently.
 * @param runtimeType GType of the object being wrapped.
 * @param isRegistered Whether a wrapper class is registered for a GType.
 */
function reportDroppedClass(runtimeType: bigint, isRegistered: (type: bigint) => boolean): void {
    if (namespaces.length === 0 || checkedTypes.has(runtimeType)) {
        return;
    }

    checkedTypes.add(runtimeType);

    for (let type = runtimeType; type !== TYPE_INVALID && !isRegistered(type); type = typeParent(type)) {
        const dropped = generatedClassFor(type);

        if (dropped !== undefined) {
            if (!warnedTypes.has(type)) {
                warnedTypes.add(type);
                warnDroppedClass(type, dropped, nearestRegisteredType(type, isRegistered));
            }

            return;
        }
    }
}

export { registerGeneratedClasses, reportDroppedClass };
