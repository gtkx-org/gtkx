import { NAMESPACE_REGISTRY } from "./generated/registry.js";
import type { Node } from "./node.js";
import { NODE_REGISTRY, type NodeClass } from "./registry.js";
import type { Container, ContainerClass, Props } from "./types.js";

export const resolveContainerClass = (type: string): ContainerClass | null => {
    for (const [prefix, namespace] of NAMESPACE_REGISTRY) {
        if (type.startsWith(prefix)) {
            const className = type.slice(prefix.length);
            return namespace[className] as ContainerClass;
        }
    }
    return null;
};

// biome-ignore lint/suspicious/noExplicitAny: Required for instanceof checks against GTK class hierarchy
type ClassKey = abstract new (...args: any[]) => any;

type RegistryKey = string | ClassKey | (string | ClassKey)[];

const matchesKey = (key: RegistryKey, typeName: string, target: object | null): boolean => {
    if (Array.isArray(key)) {
        return key.some((k) => matchesKey(k, typeName, target));
    }
    if (typeof key === "string") {
        return key === typeName;
    }
    return !!target && (target instanceof key || target === key || Object.prototype.isPrototypeOf.call(key, target));
};

export const createNode = (
    typeName: string,
    props: Props,
    existingContainer: Container | undefined,
    rootContainer: Container,
): Node => {
    const containerClass = resolveContainerClass(typeName);

    for (const [key, NodeClass] of NODE_REGISTRY) {
        if (!matchesKey(key, typeName, existingContainer ?? containerClass)) continue;
        return instantiateNode(NodeClass, typeName, props, existingContainer, containerClass, rootContainer);
    }

    throw new Error(`Unable to find node class for type '${typeName}'`);
};

const instantiateNode = (
    NodeClass: NodeClass,
    typeName: string,
    props: Props,
    existingContainer: Container | undefined,
    containerClass: ContainerClass | null,
    rootContainer: Container,
): Node => {
    const container =
        existingContainer ?? (containerClass && NodeClass.createContainer(props, containerClass, rootContainer));
    return new NodeClass(typeName, props, container, rootContainer);
};
