import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { registerNodeClass } from "../../registry.js";
import { CommitPriority, scheduleAfterCommit } from "../../scheduler.js";
import { VirtualSingleChildNode } from "../abstract/virtual-single-child.js";
import {
    attachChild,
    detachChild,
    getAttachmentStrategy,
} from "../internal/child-attachment.js";
import { isRemovable } from "../internal/predicates.js";
import { WidgetNode } from "../widget.js";
import { type AnimatableProperties, AnimationController } from "./animation-controller.js";
import type { Transition } from "./animation-factory.js";

export type AnimationProps = {
    initial?: AnimatableProperties;
    animate?: AnimatableProperties;
    transition?: Transition;
    onAnimationComplete?: () => void;
    children?: React.ReactNode;
};

type Props = Partial<AnimationProps>;

export class AnimationNode extends VirtualSingleChildNode<Props> {
    public static override priority = 2;

    private controller = new AnimationController();
    private hasAppliedInitial = false;

    public static override matches(type: string): boolean {
        return type === "Animation";
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'x.Animation': expected Widget`);
        }

        const oldChild = this.child;
        this.child = child.container;

        scheduleAfterCommit(() => {
            if (this.parent) {
                this.onChildChange(oldChild);
            }
        }, CommitPriority.NORMAL);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'x.Animation': expected Widget`);
        }

        const oldChild = this.child;

        scheduleAfterCommit(() => {
            if (oldChild === this.child) {
                this.child = null;
                this.controller.setWidget(null);
            }

            if (this.parent && oldChild) {
                this.onChildChange(oldChild);
            }
        }, CommitPriority.HIGH);
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        if (this.child) {
            this.controller.setWidget(this.child);

            if (!this.hasAppliedInitial && newProps.initial) {
                this.controller.applyImmediate(newProps.initial);
                this.hasAppliedInitial = true;
            }

            const animateChanged = !shallowObjectEqual(oldProps?.animate, newProps.animate);
            if (animateChanged && newProps.animate) {
                this.startAnimation();
            }
        }
    }

    public override unmount(): void {
        this.controller.dispose();
        this.hasAppliedInitial = false;
        super.unmount();
    }

    protected onChildChange(oldChild: Gtk.Widget | null): void {
        if (!this.parent) return;

        const strategy = getAttachmentStrategy(this.parent);
        if (!strategy) return;

        if (oldChild && !this.child) {
            detachChild(oldChild, strategy);
        } else if (oldChild && this.child && oldChild !== this.child) {
            if (isRemovable(this.parent)) {
                this.parent.remove(oldChild);
            }
            attachChild(this.child, strategy);
        } else if (!oldChild && this.child) {
            attachChild(this.child, strategy);
        }

        if (!this.child) return;

        this.controller.setWidget(this.child);

        if (!this.hasAppliedInitial && this.props.initial) {
            this.controller.applyImmediate(this.props.initial);
            this.hasAppliedInitial = true;
        }

        if (this.props.animate) {
            this.startAnimation();
        }
    }

    private startAnimation(): void {
        const from = this.props.initial ?? {};
        const to = this.props.animate ?? {};
        const transition = this.props.transition ?? {};
        const onComplete = this.props.onAnimationComplete;

        this.controller.animate(from, to, transition, onComplete);
    }
}

function shallowObjectEqual<T extends Record<string, unknown> | undefined>(a: T, b: T): boolean {
    if (a === b) return true;
    if (!a || !b) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (a[key] !== b[key]) return false;
    }

    return true;
}

registerNodeClass(AnimationNode);
