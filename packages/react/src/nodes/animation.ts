import { isObjectEqual } from "@gtkx/ffi";
import * as Adw from "@gtkx/ffi/adw";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { buildCss, interpolate } from "../animation/css-builder.js";
import type { AnimatableProperties, AnimationProps, SpringTransition, TimedTransition } from "../animation/types.js";
import { CommitPriority, scheduleAfterCommit } from "../scheduler.js";
import type { Container } from "../types.js";
import { VirtualSingleChildNode } from "./abstract/virtual-single-child.js";
import { attachChild, detachChild, getAttachmentStrategy } from "./internal/child-attachment.js";
import { isRemovable } from "./internal/predicates.js";

let animationCounter = 0;

const DEFAULT_TIMED_DURATION = 300;
const DEFAULT_SPRING_DAMPING = 1;
const DEFAULT_SPRING_MASS = 1;
const DEFAULT_SPRING_STIFFNESS = 100;

export class AnimationNode extends VirtualSingleChildNode<AnimationProps> {
    private className: string;
    private provider: Gtk.CssProvider | null = null;
    private display: Gdk.Display | null = null;
    private currentAnimation: Adw.Animation | null = null;
    private currentValues: AnimatableProperties = {};
    private isExiting = false;

    constructor(typeName: string, props: AnimationProps, container: undefined, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.className = `gtkx-anim-${animationCounter++}`;
    }

    public override updateProps(oldProps: AnimationProps | null, newProps: AnimationProps): void {
        super.updateProps(oldProps, newProps);

        if (this.isExiting) {
            return;
        }

        if (oldProps && newProps.animate && !this.arePropsEqual(oldProps.animate, newProps.animate)) {
            const target = newProps.animate;
            scheduleAfterCommit(() => {
                if (this.child && !this.isExiting) {
                    this.animateTo(target);
                }
            }, CommitPriority.LOW);
        }
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        if (oldChild && this.provider) {
            oldChild.removeCssClass(this.className);
        }

        if (oldChild && this.parent && this.isWidgetAttachedTo(oldChild, this.parent)) {
            const strategy = getAttachmentStrategy(this.parent);
            if (strategy) {
                detachChild(oldChild, strategy);
            } else if (isRemovable(this.parent)) {
                this.parent.remove(oldChild);
            }
        }

        if (this.child && this.parent) {
            const strategy = getAttachmentStrategy(this.parent);
            if (strategy) {
                attachChild(this.child, strategy);
            }

            this.setupCssProvider();
            this.child.addCssClass(this.className);

            scheduleAfterCommit(() => {
                if (!this.child) return;

                const initial = this.props.initial;
                const animate = this.props.animate;

                if (initial === false || !this.props.animateOnMount) {
                    if (animate) {
                        this.currentValues = { ...animate };
                        this.applyValues(this.currentValues);
                    }
                } else {
                    const initialValues = initial ?? animate ?? {};
                    this.currentValues = { ...initialValues };
                    this.applyValues(this.currentValues);

                    if (this.props.animateOnMount && animate) {
                        this.animateTo(animate);
                    }
                }
            }, CommitPriority.LOW);
        }
    }

    public override unmount(): void {
        if (this.isExiting) {
            return;
        }

        if (this.props.exit && this.child) {
            this.isExiting = true;

            this.animateTo(this.props.exit, () => {
                this.detachChildFromParent();
                this.cleanup();
                super.unmount();
            });
        } else {
            this.detachChildFromParent();
            this.cleanup();
            super.unmount();
        }
    }

    private detachChildFromParent(): void {
        if (this.child && this.parent && this.isChildAttachedToParent()) {
            const strategy = getAttachmentStrategy(this.parent);
            if (strategy) {
                detachChild(this.child, strategy);
            } else if (isRemovable(this.parent)) {
                this.parent.remove(this.child);
            }
        }
    }

    private isChildAttachedToParent(): boolean {
        return this.isWidgetAttachedTo(this.child, this.parent);
    }

    private isWidgetAttachedTo(child: Gtk.Widget | null, parent: Gtk.Widget | null): boolean {
        if (!child || !parent) return false;
        const childParent = child.getParent();
        return childParent !== null && isObjectEqual(childParent, parent);
    }

    private setupCssProvider(): void {
        if (this.provider || !this.child) return;

        this.provider = new Gtk.CssProvider();
        this.display = Gdk.DisplayManager.get().getDefaultDisplay();

        if (this.display) {
            Gtk.StyleContext.addProviderForDisplay(
                this.display,
                this.provider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
            );
        }
    }

    private cleanup(): void {
        if (this.currentAnimation) {
            this.currentAnimation.skip();
            this.currentAnimation = null;
        }

        if (this.provider && this.display) {
            Gtk.StyleContext.removeProviderForDisplay(this.display, this.provider);
        }

        if (this.child) {
            this.child.removeCssClass(this.className);
        }

        this.provider = null;
        this.display = null;
    }

    private animateTo(target: AnimatableProperties, onComplete?: () => void): void {
        if (!this.child) return;

        if (this.currentAnimation) {
            this.currentAnimation.skip();
            this.currentAnimation = null;
        }

        const from = { ...this.currentValues };
        const to = { ...target };

        this.props.onAnimationStart?.();

        const callback = new Adw.CallbackAnimationTarget((progress: number) => {
            const interpolated = interpolate(from, to, progress);
            this.currentValues = interpolated;
            this.applyValues(interpolated);
        });

        const animation = this.createAnimation(this.child, callback);

        animation.connect("done", () => {
            this.currentValues = { ...to };
            this.currentAnimation = null;
            this.props.onAnimationComplete?.();
            onComplete?.();
        });

        this.currentAnimation = animation;

        const transition = this.props.transition;
        const delay = (transition as TimedTransition | SpringTransition)?.delay ?? 0;

        if (delay > 0) {
            setTimeout(() => {
                if (this.currentAnimation === animation) {
                    animation.play();
                }
            }, delay);
        } else {
            animation.play();
        }
    }

    private createAnimation(widget: Gtk.Widget, target: Adw.CallbackAnimationTarget): Adw.Animation {
        const mode = this.props.mode;

        if (mode === "spring") {
            return this.createSpringAnimation(widget, target);
        }

        return this.createTimedAnimation(widget, target);
    }

    private createTimedAnimation(widget: Gtk.Widget, target: Adw.CallbackAnimationTarget): Adw.TimedAnimation {
        const transition = this.props.transition as TimedTransition | undefined;
        const duration = transition?.duration ?? DEFAULT_TIMED_DURATION;

        const animation = new Adw.TimedAnimation(widget, 0, 1, duration, target);

        if (transition?.easing !== undefined) {
            animation.setEasing(transition.easing);
        }

        if (transition?.repeat !== undefined) {
            animation.setRepeatCount(transition.repeat);
        }

        if (transition?.reverse !== undefined) {
            animation.setReverse(transition.reverse);
        }

        if (transition?.alternate !== undefined) {
            animation.setAlternate(transition.alternate);
        }

        return animation;
    }

    private createSpringAnimation(widget: Gtk.Widget, target: Adw.CallbackAnimationTarget): Adw.SpringAnimation {
        const transition = this.props.transition as SpringTransition | undefined;
        const damping = transition?.damping ?? DEFAULT_SPRING_DAMPING;
        const mass = transition?.mass ?? DEFAULT_SPRING_MASS;
        const stiffness = transition?.stiffness ?? DEFAULT_SPRING_STIFFNESS;

        const springParams = new Adw.SpringParams(damping, mass, stiffness);
        const animation = new Adw.SpringAnimation(widget, 0, 1, springParams, target);

        if (transition?.initialVelocity !== undefined) {
            animation.setInitialVelocity(transition.initialVelocity);
        }

        if (transition?.clamp !== undefined) {
            animation.setClamp(transition.clamp);
        }

        return animation;
    }

    private applyValues(values: AnimatableProperties): void {
        if (!this.provider) {
            return;
        }

        if (this.child && !this.child.getCssClasses()?.includes(this.className)) {
            this.child.addCssClass(this.className);
        }

        const css = buildCss(this.className, values);
        if (css) {
            this.provider.loadFromString(css);
        }
    }

    private arePropsEqual(a: AnimatableProperties | undefined, b: AnimatableProperties | undefined): boolean {
        if (a === b) return true;
        if (!a || !b) return false;

        const keysA = Object.keys(a) as (keyof AnimatableProperties)[];
        const keysB = Object.keys(b) as (keyof AnimatableProperties)[];

        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
            if (a[key] !== b[key]) return false;
        }

        return true;
    }
}
