type UserEventState = {
    modifierState: number;
    isMouseLeftDown: boolean;
};

const createInitialState = (): UserEventState => ({ modifierState: 0, isMouseLeftDown: false });

export { createInitialState, type UserEventState };
