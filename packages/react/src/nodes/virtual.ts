import { Node } from "../node.js";
import type { Container, Props } from "../types.js";

export class VirtualNode<P = Props> extends Node<undefined, P> {
    public static override createContainer() {}

    props: P;

    constructor(typeName: string, props: P = {} as P, container: undefined, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.props = props;
    }

    public override commitUpdate(_oldProps: P | null, newProps: P): void {
        this.props = newProps;
    }
}
