import { getSignalStore, type SignalStore } from "./nodes/internal/signal-store.js";
import type { Container, ContainerClass, Props } from "./types.js";

export class Node<T = unknown, P = unknown> {
    public static createContainer(_props: Props, _containerClass: ContainerClass, _rootContainer?: Container): unknown {
        throw new Error("Cannot create container: unsupported node type");
    }

    container: T;
    typeName: string;
    signalStore: SignalStore;
    parent: Node | null = null;
    children: Node[] = [];

    constructor(typeName: string, _props = {} as P, container: T, rootContainer: Container) {
        this.typeName = typeName;
        this.container = container;
        this.signalStore = getSignalStore(rootContainer);
    }

    public canAcceptChild(_child: Node): boolean {
        return false;
    }

    public appendInitialChild(child: Node): void {
        this.appendChild(child);
    }

    public appendChild(child: Node): void {
        child.parent = this;
        this.children.push(child);
        child.onAddedToParent(this);
    }

    public removeChild(child: Node): void {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            child.onRemovedFromParent(this);
            this.children.splice(index, 1);
            child.parent = null;
        }
    }

    public insertBefore(child: Node, before: Node): void {
        const beforeIndex = this.children.indexOf(before);
        if (beforeIndex === -1) {
            throw new Error(`Cannot find 'before' child '${before.typeName}' in '${this.typeName}'`);
        }

        const existingIndex = this.children.indexOf(child);
        if (existingIndex !== -1) {
            this.children.splice(existingIndex, 1);
            const adjustedIndex = existingIndex < beforeIndex ? beforeIndex - 1 : beforeIndex;
            this.children.splice(adjustedIndex, 0, child);
            return;
        }

        child.parent = this;
        this.children.splice(beforeIndex, 0, child);
        child.onAddedToParent(this);
    }

    public finalizeInitialChildren(props: P): boolean {
        this.commitUpdate(null, props);
        return false;
    }

    public commitUpdate(_oldProps: P | null, _newProps: P): void {}

    public commitMount(): void {}

    public detachDeletedInstance(): void {
        this.signalStore.clear(this);
    }

    public onAddedToParent(_parent: Node): void {}

    public onRemovedFromParent(_parent: Node): void {}
}
