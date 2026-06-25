export type UserEventState = {
    modifierState: number;
    mouseLeftDown: boolean;
};

export const createInitialState = (): UserEventState => ({ modifierState: 0, mouseLeftDown: false });
