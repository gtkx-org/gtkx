import type { Node } from "./node.js";
import type { Container, Props } from "./types.js";

export type NodeClass<T = unknown, P = Props> = {
    new (typeName: string, props: P, container: T, rootContainer?: Container): Node<T, P>;
} & Omit<typeof Node, "prototype">;

export const NODE_CLASSES: NodeClass[] = [];

export const registerNodeClass = <T, P>(nodeClass: NodeClass<T, P>): void => {
    NODE_CLASSES.push(nodeClass as NodeClass);
    NODE_CLASSES.sort((a, b) => a.priority - b.priority);
};
