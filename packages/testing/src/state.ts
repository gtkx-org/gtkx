/**
 * Per-instance device state shared across a user-event instance's pointer and
 * keyboard helpers, so held mouse buttons and modifier keys persist across calls.
 */
export type UserEventState = {
    modifierState: number;
    mouseLeftDown: boolean;
};

export const createInitialState = (): UserEventState => ({ modifierState: 0, mouseLeftDown: false });
