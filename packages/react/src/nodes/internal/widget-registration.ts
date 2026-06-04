import type * as Gtk from "@gtkx/gi/gtk";
import { createAfterCommitDebounce } from "../../post-commit-queue.js";

/**
 * The node-specific half of a {@link WidgetRegistrationController}: how to find
 * the widget to register, how to register and unregister it with a target
 * discovered elsewhere in the node tree, and an optional identity that forces
 * re-registration when it changes.
 *
 * @typeParam TToken - Opaque value returned by {@link register} and handed back
 * to {@link unregister}, carrying whatever the reversal needs (the target plus
 * any key used to register).
 */
export interface WidgetRegistration<TToken> {
    /** The widget to register, or `null` when there is nothing to register. */
    resolveWidget(): Gtk.Widget | null;
    /**
     * Registers `widget` with its target. Returns a token used to reverse the
     * registration, or `null` when the target is not present yet.
     */
    register(widget: Gtk.Widget): TToken | null;
    /** Reverses a prior {@link register} using the token it returned. */
    unregister(token: TToken): void;
    /**
     * Optional identity that, when it changes, forces re-registration even if
     * the widget is unchanged (e.g. a constraint target id).
     */
    identity?(): unknown;
}

/**
 * Drives the lifecycle of opting a single wrapped widget into a target
 * discovered elsewhere in the node tree — an ancestor `Gtk.SizeGroup`, a
 * sibling `Gtk.ConstraintLayout`. Marker reconciler nodes own one of these and
 * forward their lifecycle hooks to {@link sync} / {@link unregister} /
 * {@link scheduleSync}.
 *
 * {@link scheduleSync} debounces a registration attempt until after the current
 * commit (via `createAfterCommitDebounce`), so the full ancestor/sibling chain
 * is wired before the target lookup runs.
 *
 * @typeParam TToken - The reversal token produced by {@link WidgetRegistration.register}.
 */
export class WidgetRegistrationController<TToken> {
    private registeredWidget: Gtk.Widget | null = null;
    private registeredToken: TToken | null = null;
    private registeredIdentity: unknown;

    /** Schedules a debounced {@link sync} to run once at the end of the commit. */
    public readonly scheduleSync: () => void;

    constructor(private readonly registration: WidgetRegistration<TToken>) {
        this.scheduleSync = createAfterCommitDebounce(() => this.sync());
    }

    /** Whether the wrapped widget is currently registered with a target. */
    public isRegistered(): boolean {
        return this.registeredToken !== null;
    }

    /**
     * Reconciles the registration: registers the resolved widget with its
     * target, re-registers when the widget or identity changed, and unregisters
     * when there is nothing to register or no target is found.
     */
    public sync(): void {
        const widget = this.registration.resolveWidget();
        if (!widget) {
            this.unregister();
            return;
        }

        const identity = this.registration.identity?.();
        if (this.registeredWidget === widget && this.registeredIdentity === identity) {
            return;
        }

        this.unregister();

        const token = this.registration.register(widget);
        if (token === null) return;

        this.registeredWidget = widget;
        this.registeredToken = token;
        this.registeredIdentity = identity;
    }

    /** Reverses the current registration, if any. */
    public unregister(): void {
        if (this.registeredToken !== null) {
            this.registration.unregister(this.registeredToken);
        }
        this.registeredWidget = null;
        this.registeredToken = null;
        this.registeredIdentity = undefined;
    }
}
