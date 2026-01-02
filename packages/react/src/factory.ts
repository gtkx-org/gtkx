import { NAMESPACE_REGISTRY } from "./generated/registry.js";
import type { Node } from "./node.js";
import { NODE_CLASSES } from "./registry.js";
import type { Container, ContainerClass, Props } from "./types.js";
import "./nodes/index.js";

const resolveContainerClass = (type: string): ContainerClass | null => {
    for (const [prefix, namespace] of NAMESPACE_REGISTRY) {
        if (type.startsWith(prefix)) {
            const className = type.slice(prefix.length);
            return namespace[className] as ContainerClass;
        }
    }
    return null;
};

export const createNode = (
    typeName: string,
    props: Props,
    existingContainer?: Container,
    rootContainer?: Container,
): Node => {
    const containerClass = resolveContainerClass(typeName);

    for (const NodeClass of NODE_CLASSES) {
        if (NodeClass.matches(typeName, existingContainer ?? containerClass)) {
            const container =
                existingContainer ??
                (containerClass && NodeClass.createContainer(props, containerClass, rootContainer));
            return new NodeClass(typeName, props, container, rootContainer);
        }
    }

    throw new Error(`Unable to find node class for type '${typeName}'`);
};
