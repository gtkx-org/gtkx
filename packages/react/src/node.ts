import type { PropDescriptorTable } from "./nodes/internal/apply-props.js";
import { getSignalStore, type SignalStore } from "./nodes/internal/signal-store.js";
import type { Container, ContainerClass, Props } from "./types.js";

// biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
export class Node<TContainer = any, TProps = any, TParent extends Node = any, TChild extends Node = any> {
    public static createContainer(
        _typeName: string,
        _props: Props,
        _containerClass: ContainerClass,
        _rootContainer?: Container,
    ): unknown {
        throw new Error("Cannot create container: unsupported node type");
    }

    container: TContainer;
    props: TProps;
    typeName: string;
    signalStore: SignalStore;
    rootContainer: Container;
    parent: TParent | null = null;
    children: TChild[] = [];
    private cachedPropTable: PropDescriptorTable | null = null;

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

        const existingIndex = this.children.indexOf(child);
        if (existingIndex !== -1) {
            this.children.splice(existingIndex, 1);
        }
        this.children.push(child);

        if (child.parent !== this) {
            child.setParent(this);
        }
    }

    public removeChild(child: TChild): void {
        child.setParent(null);
        const index = this.children.indexOf(child);

        if (index !== -1) {
            this.children.splice(index, 1);
        }
    }

    public insertBefore(child: TChild, before: TChild): void {
        if (!this.isValidChild(child)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}'`);
        }

        const existingIndex = this.children.indexOf(child);
        if (existingIndex !== -1) {
            this.children.splice(existingIndex, 1);
        }

        const beforeIndex = this.children.indexOf(before);
        if (beforeIndex === -1) {
            throw new Error(`Cannot find 'before' child '${before.typeName}' in '${this.typeName}'`);
        }

        this.children.splice(beforeIndex, 0, child);

        if (child.parent !== this) {
            child.setParent(this);
        }
    }

    public finalizeInitialChildren(props: TProps): boolean {
        this.commitUpdate(null, props);
        return false;
    }

    public commitUpdate(_oldProps: TProps | null, newProps: TProps): void {
        this.props = newProps;
    }

    /**
     * The node's bespoke-prop descriptors, merged from its class hierarchy.
     *
     * Subclasses override this to declare props that need handling beyond the
     * generic GObject signal/property path, spreading `super.ownPropDescriptors()`
     * to compose with their ancestors' descriptors.
     */
    protected ownPropDescriptors(): PropDescriptorTable {
        return {};
    }

    /** The node's descriptor table, computed once from {@link ownPropDescriptors}. */
    protected getPropTable(): PropDescriptorTable {
        this.cachedPropTable ??= this.ownPropDescriptors();
        return this.cachedPropTable;
    }

    public commitMount?(): void;

    public detachDeletedInstance(): void {
        this.signalStore.clear(this);
    }
}
