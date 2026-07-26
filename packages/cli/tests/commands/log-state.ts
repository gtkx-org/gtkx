import { afterEach, beforeEach, type MockInstance, vi } from "vitest";

type StderrSpy = MockInstance<typeof process.stderr.write>;
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

const collectLogged = (stderrSpy: StderrSpy): string =>
    stderrSpy.mock.calls.map((call) => String(call[0])).join("");

export { setupLogState, collectLogged, type LogState };
