import { Node } from "../node.js";
import type { Container } from "../types.js";

// biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
export class VirtualNode<TProps = any, TParent extends Node = any, TChild extends Node = any> extends Node<
    undefined,
    TProps,
    TParent,
    TChild
> {
    public static override createContainer() {}

    constructor(typeName: string, props: TProps = {} as TProps, container: undefined, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
    }

    public override commitUpdate(oldProps: TProps | null, newProps: TProps): void {
        super.commitUpdate(oldProps, newProps);
    }
}
