import { createInitialState, type UserEventState } from "./state.js";

export type UserEventInstance = {
    state: UserEventState;
};

export const createInstance = (): UserEventInstance => ({ state: createInitialState() });
