import type { PropDescriptorTable } from "./nodes/internal/apply-props.js";
import { getSignalStore, type SignalStore } from "./nodes/internal/signal-store.js";
import type { BackingInstance, BackingInstanceClass, Props } from "./types.js";

// biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
export class Node<TBackingInstance = any, TProps = any, TParent extends Node = any, TChild extends Node = any> {
    public static createContainer(
        _typeName: string,
        _props: Props,
        _containerClass: BackingInstanceClass,
        _rootContainer?: BackingInstance,
    ): unknown {
        throw new Error("Cannot create container: unsupported node type");
    }

    backingInstance: TBackingInstance;
    props: TProps;
    typeName: string;
    signalStore: SignalStore;
    rootContainer: BackingInstance;
    parent: TParent | null = null;
    children: TChild[] = [];
    protected childSet = new Set<TChild>();
    private cachedPropTable: PropDescriptorTable | null = null;

    constructor(typeName: string, props: TProps, backingInstance: TBackingInstance, rootContainer: BackingInstance) {
        this.typeName = typeName;
        this.props = props;
        this.backingInstance = backingInstance;
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

    /** Whether `child` is currently a direct child of this node, in O(1). */
    public hasChild(child: TChild): boolean {
        return this.childSet.has(child);
    }

    /**
     * Removes `child` from the ordered {@link children} list, resolving its
     * index once. A missing child is left untouched, so the splice can never
     * fall back to `-1` and delete an unrelated trailing child.
     */
    private removeFromChildOrder(child: TChild): void {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
        }
    }

    public appendChild(child: TChild): void {
        if (!this.isValidChild(child)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}'`);
        }

        if (this.childSet.has(child)) {
            this.removeFromChildOrder(child);
        } else {
            this.childSet.add(child);
        }
        this.children.push(child);

        if (child.parent !== this) {
            child.setParent(this);
        }
    }

    public removeChild(child: TChild): void {
        child.setParent(null);

        if (this.childSet.delete(child)) {
            this.removeFromChildOrder(child);
        }
    }

    public insertBefore(child: TChild, before: TChild): void {
        if (!this.isValidChild(child)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}'`);
        }

        if (this.childSet.delete(child)) {
            this.removeFromChildOrder(child);
        }

        const beforeIndex = this.children.indexOf(before);
        if (beforeIndex === -1) {
            throw new Error(`Cannot find 'before' child '${before.typeName}' in '${this.typeName}'`);
        }

        this.children.splice(beforeIndex, 0, child);
        this.childSet.add(child);

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
