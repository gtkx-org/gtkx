import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flushEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Runs a callback inside React's `act`, flushing pending state updates and
 * effects, then yields one event-loop tick so GTK can process any signals
 * the update emitted.
 *
 * Mirrors `act` from `@testing-library/react`. Wrap every interaction that
 * mutates React state or fires a GTK signal so assertions see the settled
 * tree.
 *
 * @example
 * ```tsx
 * import { act } from "@gtkx/testing";
 *
 * await act(() => widget.activate());
 * expect(widget.getSensitive()).toBe(false);
 * ```
 */
export const act = async <T>(callback: () => T | Promise<T>): Promise<T> => {
    let result!: T;
    await reactAct(async () => {
        result = await callback();
        await flushEventLoop();
    });
    return result;
};
