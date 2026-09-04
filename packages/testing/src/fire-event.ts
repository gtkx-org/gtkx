import * as GObject from "@gtkx/gi/gobject";
import { runInAct } from "./act.js";

/**
 * A signal emission built but not yet delivered. GObject has no event object to construct, so this
 * records the target, signal, and arguments {@link fireEvent} will emit.
 */
type WidgetEvent = {
    /** The GObject instance the signal is emitted on. */
    target: Pick<GObject.Object, "__type__">;
    /** Name of the signal to emit. */
    signalName: string;
    /** Arguments passed to the signal handlers. */
    args: unknown[];
};

const requireObject = (target: object): GObject.Object => {
    if (!(target instanceof GObject.Object)) {
        throw new TypeError("Expected a GObject instance");
    }

    return target;
};

/**
 * Records a signal emission without delivering it, so it can be inspected or held and passed to
 * {@link fireEvent} later.
 *
 * @param target The GObject instance the signal would be emitted on.
 * @param signalName Name of the signal to emit.
 * @param args Arguments to pass to the signal handlers.
 * @returns The recorded emission.
 */
const createEvent = (
    target: Pick<GObject.Object, "__type__">,
    signalName: string,
    ...args: unknown[]
): WidgetEvent => ({
    target: requireObject(target),
    signalName,
    args,
});

const dispatchEvent = async (event: WidgetEvent): Promise<void> => {
    const target = requireObject(event.target);

    await runInAct(() => {
        Reflect.apply(GObject.signalEmit, undefined, [target, event.signalName, ...event.args]);
    });
};

const isWidgetEvent = (value: object): value is WidgetEvent =>
    "target" in value && "signalName" in value && "args" in value &&
    typeof value.signalName === "string" && Array.isArray(value.args);

/**
 * Emits a recorded signal emission inside React's act environment, so any resulting state updates are
 * flushed before the promise resolves.
 *
 * @param event An emission built by {@link createEvent}.
 */
function fireEvent(event: WidgetEvent): Promise<void>;
/**
 * Emits a GObject signal on a widget or object inside React's act environment, so any resulting state
 * updates are flushed before the promise resolves.
 *
 * @param target The GObject instance to emit the signal on.
 * @param signalName Name of the signal to emit.
 * @param args Arguments passed to the signal handlers.
 */
function fireEvent(
    target: Pick<GObject.Object, "__type__">,
    signalName: string,
    ...args: unknown[]
): Promise<void>;

function fireEvent(
    eventOrTarget: WidgetEvent | Pick<GObject.Object, "__type__">,
    signalName?: string,
    ...args: unknown[]
): Promise<void> {
    if (signalName === undefined && isWidgetEvent(eventOrTarget)) {
        return dispatchEvent(eventOrTarget);
    }

    if (signalName === undefined) {
        throw new Error("Unable to fire an event: pass a signal name, or an event built by createEvent.");
    }

    const target = requireObject(eventOrTarget);

    return dispatchEvent({ target, signalName, args });
}

export { createEvent, fireEvent, type WidgetEvent };
