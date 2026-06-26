import { createInitialState, type UserEventState } from "./state.js";

/**
 * Per-session state shared by every helper bound through {@link userEvent.setup}.
 *
 * Each session owns an isolated {@link UserEventState} so concurrent sessions do
 * not leak modifier or pointer state into one another.
 */
export type UserEventInstance = {
    state: UserEventState;
};

export const createInstance = (): UserEventInstance => ({ state: createInitialState() });
