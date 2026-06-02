import { Node } from "../node.js";

// biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
export class VirtualNode<TProps = any, TParent extends Node = any, TChild extends Node = any> extends Node<
    undefined,
    TProps,
    TParent,
    TChild
> {
    public static override createContainer(): undefined {
        return undefined;
    }
}
