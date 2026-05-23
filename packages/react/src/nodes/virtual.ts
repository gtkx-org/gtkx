import { Node } from "../node.js";
import type { Container } from "../types.js";

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

    constructor(typeName: string, props: TProps, container: undefined, rootContainer: Container) {
        super(typeName, props ?? ({} as TProps), container, rootContainer);
    }
}
