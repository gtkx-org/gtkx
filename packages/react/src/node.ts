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
    private childIndices = new Map<TChild, number>();
    private childrenDirty = false;

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
        if (this.childrenDirty) this.flushChildRemovals();
        if (!this.isValidChild(child)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}'`);
        }
        this.childIndices.set(child, this.children.length);
        this.children.push(child);
        child.setParent(this);
    }

    public removeChild(child: TChild): void {
        if (!this.childIndices.has(child)) return;
        child.setParent(null);
        this.childIndices.delete(child);
        if (!this.childrenDirty) {
            this.childrenDirty = true;
            queueMicrotask(() => this.flushChildRemovals());
        }
    }

    public insertBefore(child: TChild, before: TChild): void {
        if (this.childrenDirty) this.flushChildRemovals();

        const beforeIndex = this.childIndices.get(before);
        if (beforeIndex === undefined) {
            throw new Error(`Cannot find 'before' child '${before.typeName}' in '${this.typeName}'`);
        }

        const existingIndex = this.childIndices.get(child);
        if (existingIndex !== undefined) {
            this.children.splice(existingIndex, 1);
            const adjustedIndex = existingIndex < beforeIndex ? beforeIndex - 1 : beforeIndex;
            this.children.splice(adjustedIndex, 0, child);
            this.rebuildChildIndices(Math.min(existingIndex, adjustedIndex));
            return;
        }

        if (!this.isValidChild(child)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}'`);
        }

        this.children.splice(beforeIndex, 0, child);
        this.rebuildChildIndices(beforeIndex);
        child.setParent(this);
    }

    private flushChildRemovals(): void {
        if (!this.childrenDirty) return;
        this.childrenDirty = false;
        this.children = this.children.filter((c) => this.childIndices.has(c));
        this.childIndices.clear();
        for (let i = 0; i < this.children.length; i++) {
            this.childIndices.set(this.children[i] as TChild, i);
        }
    }

    private rebuildChildIndices(fromIndex: number): void {
        for (let i = fromIndex; i < this.children.length; i++) {
            this.childIndices.set(this.children[i] as TChild, i);
        }
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
