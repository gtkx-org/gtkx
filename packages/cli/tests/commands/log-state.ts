import { afterEach, beforeEach, vi } from "vitest";
import type { StderrSpy } from "../stderr-text.js";

type LogState = { stderrSpy: StderrSpy };

const setupLogState = (): LogState => {
    const state = {} as LogState;

    beforeEach(() => {
        vi.clearAllMocks();
        state.stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        state.stderrSpy.mockRestore();
    });

    return state;
};

export { setupLogState };
