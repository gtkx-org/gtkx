export type MuteState = {
    muteDepth: number;
};

export const runMuted = (state: MuteState, run: () => void): void => {
    state.muteDepth += 1;
    try {
        run();
    } finally {
        state.muteDepth -= 1;
    }
};
