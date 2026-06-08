import * as Gtk from "@gtkx/gi/gtk";
import { Node } from "../node.js";
import { createAfterCommitDebounce, createLateAfterCommitDebounce } from "../post-commit-queue.js";
import type { BackingInstance, ContainerInfo, Props } from "../types.js";
import { ElementNode } from "./element.js";
import type { AttachStrategy } from "./internal/attach-strategy.js";
import {
    type AttachContext,
    type AttachState,
    executeAttach,
    executeDetach,
    executeMetaUpdate,
} from "./internal/strategy-interpreter.js";
import { isBufferContentKind } from "./internal/text-buffer-kinds.js";
import { scheduleBufferRebuild } from "./internal/text-buffer-rebuild.js";
import {
    NOTEBOOK_TAB_KIND,
    resolveWrapperStrategy,
    type WrapperCardinality,
    wrapperCardinality,
} from "./internal/wrapper-strategy.js";

const META_OBJECT_KIND = "meta-object";

/**
 * The single JSX element name that maps to {@link WrapperNode}. Every metadata
 * wrapper renders this sentinel element and passes its concrete kind (e.g.
 * `"slot"`, `"meta-object"`) through the `kind` prop, which the factory forwards
 * to the `WrapperNode` constructor.
 */
export const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

/**
 * The single metadata-container node. A `WrapperNode` has no backing GObject; it
 * carries attachment metadata (title, column, id, …) for its child(ren) and
 * drives how they attach to the grandparent GObject through the strategy
 * interpreter. It subsumes every metadata wrapper through a small set of generic
 * kinds (`"slot"`, `"container-slot"`, `"meta-object"`, `"layout-child"`,
 * `"overlay"`, `"wrap-then-add"`, `"transparent"`, `"notebook-tab"`), with the
 * per-kind behavior resolved against the live parent by the wrapper strategy.
 */
export class WrapperNode<P extends Props = Props> extends Node<undefined, P, Node, Node> {
    public static override createContainer(): undefined {
        return undefined;
    }

    /** The generic wrapper kind name (e.g. `"slot"`, `"meta-object"`). */
    public readonly kind: string;

    private readonly config: WrapperCardinality;
    private readonly attachStates = new Map<BackingInstance, AttachState>();
    private resolvedStrategy: AttachStrategy | null = null;
    private selfState: AttachState = null;
    private selfAttached = false;
    private readonly scheduleAttach: () => void;

    /**
     * Whether the wrapper carries buffered text content (raw text, inline
     * paintable, anchored widget). Such wrappers run no attach strategy: their
     * children and props are read by the text-buffer controller, so every
     * mutation only schedules a buffer rebuild of the enclosing text view.
     */
    private readonly bufferContent: boolean;

    constructor(kind: string, props: P, _container: undefined, rootContainer: ContainerInfo) {
        super(kind, props, undefined, rootContainer);
        this.kind = kind;
        this.config = wrapperCardinality(kind);
        this.bufferContent = isBufferContentKind(kind);
        const debounce = this.config.selfBuilt ? createLateAfterCommitDebounce : createAfterCommitDebounce;
        this.scheduleAttach = debounce(() => this.runDeferredAttach());
    }

    public override isValidChild(_child: Node): boolean {
        return true;
    }

    public override isValidParent(_parent: Node): boolean {
        return true;
    }

    public override appendChild(child: Node): void {
        if (this.bufferContent) {
            super.appendChild(child);
            scheduleBufferRebuild(this);
            return;
        }
        if (this.config.selfBuilt) {
            super.appendChild(child);
            return;
        }
        if (this.config.singleTracked) {
            this.withTrackedChange(() => super.appendChild(child));
        } else {
            super.appendChild(child);
            const instance = child.backingInstance as BackingInstance | undefined;
            if (instance) {
                this.detachInstance(instance, false);
                this.attachInstance(instance);
            }
        }
    }

    public override removeChild(child: Node): void {
        if (this.bufferContent) {
            scheduleBufferRebuild(this);
            super.removeChild(child);
            return;
        }
        if (this.config.selfBuilt) {
            super.removeChild(child);
            return;
        }
        if (this.config.singleTracked) {
            this.withTrackedChange(() => super.removeChild(child));
        } else {
            this.detachOne(child.backingInstance as BackingInstance | undefined, false);
            super.removeChild(child);
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        if (this.bufferContent) {
            super.insertBefore(child, before);
            scheduleBufferRebuild(this);
            return;
        }
        if (this.config.selfBuilt) {
            super.insertBefore(child, before);
            return;
        }
        if (this.config.singleTracked) {
            this.withTrackedChange(() => super.insertBefore(child, before));
        } else {
            super.insertBefore(child, before);
            this.reinsertAll();
        }
    }

    public override setParent(parent: Node | null): void {
        if (this.bufferContent) {
            const previous = this.parent;
            super.setParent(parent);
            scheduleBufferRebuild(parent ?? previous ?? this);
            return;
        }
        if (!parent && this.parent) this.detachAll(false);
        super.setParent(parent);
        if (parent) this.attachAll();
    }

    public override commitUpdate(oldProps: P | null, newProps: P): void {
        super.commitUpdate(oldProps, newProps);
        if (this.bufferContent) {
            scheduleBufferRebuild(this);
            return;
        }
        if (this.config.deferAttach) {
            this.scheduleAttach();
            return;
        }
        this.applyMetaUpdate();
    }

    public override detachDeletedInstance(): void {
        if (this.bufferContent) {
            super.detachDeletedInstance();
            return;
        }
        const target = this.resolveTarget();
        const strategy = target ? this.resolveStrategy(target) : null;
        if (!(strategy && "skipDetachOnDelete" in strategy && strategy.skipDetachOnDelete)) {
            this.detachAll(false);
        }
        super.detachDeletedInstance();
    }

    private resolveTarget(): BackingInstance | null {
        const parent = this.parent;
        if (parent instanceof ElementNode && parent.backingInstance) {
            return parent.backingInstance;
        }
        return null;
    }

    private resolveStrategy(target: BackingInstance): AttachStrategy {
        const strategy = resolveWrapperStrategy(this.kind, this.props, target) ?? this.resolvedStrategy;
        if (!strategy) {
            throw new Error(`No attach strategy for '<${this.kind}>' under '${target.constructor.name}'`);
        }
        this.resolvedStrategy = strategy;
        return strategy;
    }

    private trackedChild(): Node | null {
        return this.config.trackedChildSelector?.(this.children) ?? this.children[0] ?? null;
    }

    private trackedChildInstance(): BackingInstance | null {
        const child = this.trackedChild();
        const instance = child?.backingInstance as BackingInstance | undefined;
        return instance ?? null;
    }

    private withTrackedChange(mutate: () => void): void {
        const oldChild = this.trackedChildInstance();
        mutate();
        const newChild = this.trackedChildInstance();
        if (!this.resolveTarget() || newChild === oldChild) return;
        if (this.config.deferAttach) {
            if (oldChild) this.detachInstance(oldChild, newChild != null);
            this.scheduleAttach();
            return;
        }
        if (oldChild) this.detachInstance(oldChild, newChild != null);
        if (newChild) this.attachInstance(newChild);
    }

    private attachAll(): void {
        if (this.config.selfBuilt) {
            this.scheduleAttach();
            return;
        }
        if (this.config.singleTracked) {
            if (this.config.deferAttach) {
                this.scheduleAttach();
                return;
            }
            const instance = this.trackedChildInstance();
            if (instance) this.attachInstance(instance);
            return;
        }
        for (const child of this.children) this.attachOne(child);
    }

    private detachAll(replacement: boolean): void {
        if (this.config.selfBuilt) {
            this.detachSelf(replacement);
            return;
        }
        for (const childInstance of [...this.attachStates.keys()]) {
            this.detachInstance(childInstance, replacement);
        }
    }

    private applyMetaUpdate(): void {
        const target = this.resolveTarget();
        if (!target) return;
        const strategy = this.resolveStrategy(target);
        if (this.config.selfBuilt) {
            if (!this.selfAttached) return;
            this.selfState = executeMetaUpdate(this.buildContext(target), strategy, this.selfState);
            return;
        }
        for (const [childInstance, state] of this.attachStates) {
            const next = executeMetaUpdate(this.buildContext(target, childInstance), strategy, state);
            this.attachStates.set(childInstance, next);
        }
    }

    private runDeferredAttach(): void {
        const target = this.resolveTarget();
        if (!target) return;
        if (this.config.selfBuilt) {
            this.attachSelf();
            return;
        }
        const instance = this.trackedChildInstance();
        if (!instance) return;
        if (this.attachStates.has(instance)) {
            this.applyMetaUpdate();
            return;
        }
        this.attachInstance(instance);
    }

    private attachSelf(): void {
        const target = this.resolveTarget();
        if (!target) return;
        const strategy = this.resolveStrategy(target);
        if (this.selfAttached) {
            this.selfState = executeMetaUpdate(this.buildContext(target), strategy, this.selfState);
            return;
        }
        this.selfState = executeAttach(this.buildContext(target), strategy);
        this.selfAttached = true;
    }

    private detachSelf(replacement: boolean): void {
        const target = this.resolveTarget();
        if (target && this.selfAttached) {
            const strategy = this.resolveStrategy(target);
            executeDetach(this.buildContext(target), strategy, this.selfState, replacement);
        }
        this.selfState = null;
        this.selfAttached = false;
    }

    private reinsertAll(): void {
        if (!this.resolveTarget()) return;
        const instances = this.children
            .map((child) => child.backingInstance as BackingInstance | undefined)
            .filter((instance): instance is BackingInstance => instance != null);
        for (const instance of instances) this.detachInstance(instance, false);
        for (const instance of instances) this.attachInstance(instance);
    }

    private attachOne(child: Node): void {
        const instance = child.backingInstance as BackingInstance | undefined;
        if (instance) this.attachInstance(instance);
    }

    private detachOne(instance: BackingInstance | undefined, replacement: boolean): void {
        if (instance) this.detachInstance(instance, replacement);
    }

    private attachInstance(childInstance: BackingInstance): void {
        const target = this.resolveTarget();
        if (!target) return;
        const strategy = this.resolveStrategy(target);
        const state = executeAttach(this.buildContext(target, childInstance), strategy);
        this.attachStates.set(childInstance, state);
    }

    private detachInstance(childInstance: BackingInstance, replacement: boolean): void {
        const target = this.resolveTarget();
        if (!target) return;
        const strategy = this.resolveStrategy(target);
        const state = this.attachStates.get(childInstance) ?? null;
        executeDetach(this.buildContext(target, childInstance), strategy, state, replacement);
        this.attachStates.delete(childInstance);
    }

    private buildContext(target: BackingInstance, childInstance?: BackingInstance): AttachContext {
        if (this.kind === META_OBJECT_KIND && target instanceof Gtk.Notebook) {
            return {
                props: this.props,
                parentInstance: target,
                childInstance,
                tabLabel: this.resolveTabLabel(),
                position: this.resolveNotebookPosition(),
            };
        }
        return { props: this.props, parentInstance: target, childInstance };
    }

    private resolveTabLabel(): Gtk.Widget | null {
        const tabNode = this.children.find((child) => child.typeName === NOTEBOOK_TAB_KIND);
        const label = tabNode?.children[0]?.backingInstance;
        return label instanceof Gtk.Widget ? label : null;
    }

    private resolveNotebookPosition(): number | null {
        if (!this.parent) return null;
        const siblings = this.parent.children.filter((child) => child.typeName === META_OBJECT_KIND);
        const index = siblings.indexOf(this);
        return index >= 0 ? index : null;
    }
}
