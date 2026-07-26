import { afterEach, beforeEach, type MockInstance, vi } from "vitest";

type StderrSpy = MockInstance<typeof process.stderr.write>;

export type LogState = { stderrSpy: StderrSpy };

export const setupLogState = (): LogState => {
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

export const collectLogged = (stderrSpy: StderrSpy): string =>
    stderrSpy.mock.calls.map((call) => String(call[0])).join("");
