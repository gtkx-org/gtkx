import * as Adw from "@gtkx/ffi/adw";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import type { AnimatableProperties, AnimationProps, SpringTransition, TimedTransition } from "../jsx.js";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import { attachChild, detachChild, isAttachedTo } from "./internal/widget.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

let animationCounter = 0;

const DEFAULT_TIMED_DURATION = 300;
const DEFAULT_SPRING_DAMPING = 1;
const DEFAULT_SPRING_MASS = 1;
const DEFAULT_SPRING_STIFFNESS = 100;

export class AnimationNode extends VirtualNode<AnimationProps, WidgetNode, WidgetNode> {
    private className: string;
    private provider: Gtk.CssProvider | null = null;
    private display: Gdk.Display | null = null;
    private currentAnimation: Adw.Animation | null = null;
    private currentValues: AnimatableProperties = {};
    private isExiting = false;
    private detachedParentWidget: Gtk.Widget | null = null;

    constructor(typeName: string, props: AnimationProps, container: undefined, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.className = `gtkx-anim-${animationCounter++}`;
    }

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode | null): void {
        if (!parent && this.parent) {
            this.detachedParentWidget = this.parent.container;
        }

        super.setParent(parent);

        if (parent && this.children[0]) {
            this.onChildChange(null);
        }
    }

    public override appendChild(child: WidgetNode): void {
        const oldChildWidget = this.children[0]?.container ?? null;

        super.appendChild(child);

        if (this.parent) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override removeChild(child: WidgetNode): void {
        const oldChildWidget = child.container;

        super.removeChild(child);

        if (this.parent && oldChildWidget) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override finalizeInitialChildren(props: AnimationProps): boolean {
        this.commitUpdate(null, props);
        return !!props.animateOnMount;
    }

    public override commitMount(): void {
        const animate = this.props.animate;

        if (this.props.animateOnMount && animate) {
            this.animateTo(animate);
        }
    }

    public override commitUpdate(oldProps: AnimationProps | null, newProps: AnimationProps): void {
        super.commitUpdate(oldProps, newProps);

        if (this.isExiting) {
            return;
        }

        if (oldProps && newProps.animate && !this.areAnimatedPropsEqual(oldProps.animate, newProps.animate)) {
            const target = newProps.animate;
            if (this.children[0] && !this.isExiting) {
                this.animateTo(target);
            }
        }
    }

    public override detachDeletedInstance(): void {
        if (this.isExiting) {
            return;
        }

        if (this.props.exit && this.children[0]) {
            this.isExiting = true;

            this.animateTo(this.props.exit, () => {
                this.detachChildFromParentWidget();
                this.cleanup();
                super.detachDeletedInstance();
            });
        } else {
            this.detachChildFromParentWidget();
            this.cleanup();
            super.detachDeletedInstance();
        }
    }

    private onChildChange(oldChild: Gtk.Widget | null): void {
        const parentWidget = this.parent?.container ?? null;
        const childWidget = this.children[0]?.container ?? null;

        if (oldChild && this.provider) {
            oldChild.removeCssClass(this.className);
        }

        if (oldChild && parentWidget && isAttachedTo(oldChild, parentWidget)) {
            detachChild(oldChild, parentWidget);
        }

        if (childWidget && parentWidget) {
            attachChild(childWidget, parentWidget);

            this.setupCssProvider();
            childWidget.addCssClass(this.className);

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
            }
        }
    }

    private detachChildFromParentWidget(): void {
        const parentWidget = this.parent?.container ?? this.detachedParentWidget;
        const childWidget = this.children[0]?.container ?? null;

        if (childWidget && parentWidget && isAttachedTo(childWidget, parentWidget)) {
            detachChild(childWidget, parentWidget);
        }
    }

    private setupCssProvider(): void {
        const childWidget = this.children[0]?.container ?? null;
        if (this.provider || !childWidget) return;

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
        const childWidget = this.children[0]?.container ?? null;

        if (this.currentAnimation) {
            this.currentAnimation.skip();
            this.currentAnimation = null;
        }

        if (this.provider && this.display) {
            Gtk.StyleContext.removeProviderForDisplay(this.display, this.provider);
        }

        if (childWidget) {
            childWidget.removeCssClass(this.className);
        }

        this.provider = null;
        this.display = null;
    }

    private animateTo(target: AnimatableProperties, onComplete?: () => void): void {
        const childWidget = this.children[0]?.container ?? null;
        if (!childWidget) return;

        if (this.currentAnimation) {
            this.currentAnimation.skip();
            this.currentAnimation = null;
        }

        const from = { ...this.currentValues };
        const to = { ...target };

        this.props.onAnimationStart?.();

        const callback = new Adw.CallbackAnimationTarget((progress: number) => {
            const interpolated = this.interpolate(from, to, progress);
            this.currentValues = interpolated;
            this.applyValues(interpolated);
        });

        const animation = this.createAnimation(childWidget, callback);

        animation.connect("done", () => {
            this.currentValues = { ...to };
            this.currentAnimation = null;
            this.props.onAnimationComplete?.();
            onComplete?.();
        });

        this.currentAnimation = animation;

        const transition = this.props.transition;
        const delay = transition?.delay ?? 0;

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
        const transition = this.props.transition;

        if (transition?.mode === "spring") {
            return this.createSpringAnimation(widget, target, transition);
        }

        return this.createTimedAnimation(widget, target, transition);
    }

    private createTimedAnimation(
        widget: Gtk.Widget,
        target: Adw.CallbackAnimationTarget,
        transition: TimedTransition | undefined,
    ): Adw.TimedAnimation {
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

    private createSpringAnimation(
        widget: Gtk.Widget,
        target: Adw.CallbackAnimationTarget,
        transition: SpringTransition,
    ): Adw.SpringAnimation {
        const damping = transition.damping ?? DEFAULT_SPRING_DAMPING;
        const mass = transition.mass ?? DEFAULT_SPRING_MASS;
        const stiffness = transition.stiffness ?? DEFAULT_SPRING_STIFFNESS;

        const springParams = new Adw.SpringParams(damping, mass, stiffness);
        const animation = new Adw.SpringAnimation(widget, 0, 1, springParams, target);

        if (transition.initialVelocity !== undefined) {
            animation.setInitialVelocity(transition.initialVelocity);
        }

        if (transition.clamp !== undefined) {
            animation.setClamp(transition.clamp);
        }

        return animation;
    }

    private applyValues(values: AnimatableProperties): void {
        if (!this.provider) {
            return;
        }

        const childWidget = this.children[0]?.container ?? null;
        if (childWidget && !childWidget.getCssClasses()?.includes(this.className)) {
            childWidget.addCssClass(this.className);
        }

        const css = this.buildCss(this.className, values);
        if (css) {
            this.provider.loadFromString(css);
        }
    }

    private getDefaultValue(property: keyof AnimatableProperties): number {
        switch (property) {
            case "opacity":
            case "scale":
            case "scaleX":
            case "scaleY":
                return 1;
            default:
                return 0;
        }
    }

    private interpolate(from: AnimatableProperties, to: AnimatableProperties, progress: number): AnimatableProperties {
        const result: AnimatableProperties = {};

        const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]) as Set<keyof AnimatableProperties>;

        for (const key of allKeys) {
            const fromVal = from[key] ?? this.getDefaultValue(key);
            const toVal = to[key] ?? this.getDefaultValue(key);
            result[key] = fromVal + (toVal - fromVal) * progress;
        }

        return result;
    }

    private buildCss(className: string, props: AnimatableProperties): string {
        const parts: string[] = [];
        const transforms: string[] = [];

        if (props.opacity !== undefined) {
            parts.push(`opacity: ${props.opacity}`);
        }

        if (props.translateX !== undefined || props.translateY !== undefined) {
            transforms.push(`translate(${props.translateX ?? 0}px, ${props.translateY ?? 0}px)`);
        }

        if (props.scale !== undefined) {
            transforms.push(`scale(${props.scale})`);
        } else if (props.scaleX !== undefined || props.scaleY !== undefined) {
            transforms.push(`scale(${props.scaleX ?? 1}, ${props.scaleY ?? 1})`);
        }

        if (props.rotate !== undefined) {
            transforms.push(`rotate(${props.rotate}deg)`);
        }

        if (props.skewX !== undefined) {
            transforms.push(`skewX(${props.skewX}deg)`);
        }

        if (props.skewY !== undefined) {
            transforms.push(`skewY(${props.skewY}deg)`);
        }

        if (transforms.length > 0) {
            parts.push(`transform: ${transforms.join(" ")}`);
        }

        if (parts.length === 0) {
            return "";
        }

        return `.${className} { ${parts.join("; ")}; }`;
    }

    private areAnimatedPropsEqual<T extends Record<string, unknown>>(a?: T, b?: T): boolean {
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
}
