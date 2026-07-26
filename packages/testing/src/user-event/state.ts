type UserEventState = {
    modifierState: number;
    mouseLeftDown: boolean;
};

const createInitialState = (): UserEventState => ({ modifierState: 0, mouseLeftDown: false });

export { createInitialState, type UserEventState };
