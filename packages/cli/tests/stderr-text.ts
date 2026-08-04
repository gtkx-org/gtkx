import type { MockInstance } from "vitest";

type StderrSpy = MockInstance<typeof process.stderr.write>;

const collectLogged = (stderrSpy: StderrSpy): string => stderrSpy.mock.calls.map((call) => String(call[0])).join("");

export { collectLogged, type StderrSpy };
