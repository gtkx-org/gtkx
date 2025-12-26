import { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, Props } from "../types.js";

export class VirtualNode<P = Props> extends Node<undefined, P> {
    public static override priority = 1;

    public static override matches(_type: string) {
        return false;
    }

    public static override createContainer() {}

    props: P;

    constructor(typeName: string, props: P = {} as P, container: undefined, rootContainer?: Container) {
        super(typeName, props, container, rootContainer);
        this.props = props;
    }

    public appendChild(_child: Node): void {}
    public removeChild(_child: Node): void {}
    public insertBefore(_child: Node, _before: Node): void {}

    public updateProps(_oldProps: P | null, newProps: P): void {
        this.props = newProps;
    }
}

registerNodeClass(VirtualNode);
