import type { ClickSite } from "./click.js";

type UserEventState = {
    modifierState: number;
    heldButtons: Map<number, ClickSite[]>;
};

const createInitialState = (): UserEventState => ({ modifierState: 0, heldButtons: new Map() });

export { createInitialState, type UserEventState };
