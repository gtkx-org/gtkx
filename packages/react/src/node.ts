import { SignalStore } from "./nodes/internal/signal-store.js";
import type { Container, ContainerClass, Props } from "./types.js";

export class Node<T = unknown, P = Props> {
    public static priority = 0;

    public static matches(_type: string, _containerOrClass?: Container | ContainerClass): boolean {
        return false;
    }

    public static createContainer(_props: Props, _containerClass: ContainerClass, _rootContainer?: Container): unknown {
        throw new Error("Attempted to create container for unsupported node type");
    }

    container: T;
    typeName: string;
    protected signalStore: SignalStore;

    constructor(typeName: string, _props = {} as P, container: T, _rootContainer?: Container) {
        this.typeName = typeName;
        this.container = container;
        this.signalStore = new SignalStore();
    }

    public appendChild(_child: Node) {}
    public removeChild(_child: Node) {}
    public insertBefore(_child: Node, _before: Node) {}
    public updateProps(_oldProps: P | null, _newProps: P) {}
    public mount() {}

    public unmount() {
        this.signalStore.clear();
    }
}
