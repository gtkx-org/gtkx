import { signalStore } from "./nodes/internal/signal-store.js";
import type { Container, ContainerClass, Props } from "./types.js";

export class Node<T = unknown, P = Props> {
    public static priority = 0;

    public static matches(_type: string, _containerOrClass?: Container | ContainerClass | null): boolean {
        return false;
    }

    public static createContainer(_props: Props, _containerClass: ContainerClass, _rootContainer?: Container): unknown {
        throw new Error("Cannot create container: unsupported node type");
    }

    container: T;
    typeName: string;

    constructor(typeName: string, _props = {} as P, container: T, _rootContainer?: Container) {
        this.typeName = typeName;
        this.container = container;
    }

    public appendChild(_child: Node) {}
    public removeChild(_child: Node) {}
    public insertBefore(_child: Node, _before: Node) {}
    public updateProps(_oldProps: P | null, _newProps: P) {}
    public mount() {}

    public unmount() {
        signalStore.clear(this);
    }
}
