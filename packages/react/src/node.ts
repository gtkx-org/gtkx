import { getSignalStore, type SignalStore } from "./nodes/internal/signal-store.js";
import type { Container, ContainerClass, Props } from "./types.js";

// biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
export class Node<TContainer = any, TProps = any, TParent extends Node = any, TChild extends Node = any> {
    public static createContainer(_props: Props, _containerClass: ContainerClass, _rootContainer?: Container): unknown {
        throw new Error("Cannot create container: unsupported node type");
    }

    container: TContainer;
    props: TProps;
    typeName: string;
    signalStore: SignalStore;
    rootContainer: Container;
    parent: TParent | null = null;
    children: TChild[] = [];

    constructor(typeName: string, props: TProps, container: TContainer, rootContainer: Container) {
        this.typeName = typeName;
        this.props = props;
        this.container = container;
        this.rootContainer = rootContainer;
        this.signalStore = getSignalStore(rootContainer);
    }

    public isValidChild(_child: Node): boolean {
        return false;
    }

    public isValidParent(_parent: Node): boolean {
        return true;
    }

    public setParent(parent: TParent | null): void {
        if (parent !== null && !this.isValidParent(parent)) {
            throw new Error(`Cannot add '${this.typeName}' to '${parent.typeName}'`);
        }
        this.parent = parent;
    }

    public appendInitialChild(child: TChild): void {
        this.appendChild(child);
    }

    public appendChild(child: TChild): void {
        if (!this.isValidChild(child)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}'`);
        }
        this.children.push(child);
        child.setParent(this);
    }

    public removeChild(child: TChild): void {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            child.setParent(null);
            this.children.splice(index, 1);
        }
    }

    public insertBefore(child: TChild, before: TChild): void {
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

        if (!this.isValidChild(child)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}'`);
        }

        this.children.splice(beforeIndex, 0, child);
        child.setParent(this);
    }

    public finalizeInitialChildren(props: TProps): boolean {
        this.commitUpdate(null, props);
        return false;
    }

    public commitUpdate(_oldProps: TProps | null, newProps: TProps): void {
        this.props = newProps;
    }

    public commitMount(): void {}

    public detachDeletedInstance(): void {
        this.signalStore.clear(this);
    }
}
