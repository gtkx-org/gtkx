type UserEventState = {
    modifierState: number;
    heldButtons: Set<number>;
};

const createInitialState = (): UserEventState => ({ modifierState: 0, heldButtons: new Set() });

export { createInitialState, type UserEventState };
