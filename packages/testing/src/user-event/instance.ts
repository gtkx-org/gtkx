import { createInitialState, type UserEventState } from "./state.js";

/**
 * The input-device state threaded through the `keyboard` and `pointer` helpers.
 *
 * It owns a single {@link UserEventState} holding the active keyboard modifier
 * mask and mouse-button state so that key and pointer sequences observe each
 * other's held buttons and modifiers.
 */
export type UserEventInstance = {
    state: UserEventState;
};

export const createInstance = (): UserEventInstance => ({ state: createInitialState() });
