import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/codegen/run-codegen.js", () => ({
    preflightCodegen: vi.fn(async () => undefined),
    ensureGenerated: vi.fn(async () => true),
    runCodegen: vi.fn(async () => ({
        configFile: "/project/gtkx.config.ts",
        config: { libraries: ["Gtk-4.0", "Adw-1"] },
        girPath: ["/usr/share/gir-1.0"],
        libraries: ["Gtk-4.0", "Adw-1"],
        namespaces: 2,
        widgets: 142,
        duration: 250,
    })),
}));

import { ensureGenerated, runCodegen } from "../../src/codegen/run-codegen.js";
import { codegen } from "../../src/commands/codegen.js";

const runCodegenMock = vi.mocked(runCodegen);
const ensureGeneratedMock = vi.mocked(ensureGenerated);

type CodegenArgs = { force?: boolean; cwd?: string };
type CommandRun = (ctx: { args: CodegenArgs }) => Promise<unknown>;

const run = (args: CodegenArgs): Promise<unknown> => (codegen.run as unknown as CommandRun)({ args });

type LogState = { logSpy: ReturnType<typeof vi.spyOn> };

const setupLogState = (): LogState => {
    const state = {} as LogState;
    beforeEach(() => {
        vi.clearAllMocks();
        state.logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    });
    afterEach(() => {
        state.logSpy.mockRestore();
    });
    return state;
};

const collectLogged = (logSpy: ReturnType<typeof vi.spyOn>): string =>
    logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");

describe("codegen command (default — conditional)", () => {
    const state = setupLogState();

    it("delegates to ensureGenerated and reports a regeneration", async () => {
        await run({ cwd: "/custom/dir" });

        expect(ensureGeneratedMock).toHaveBeenCalledWith(expect.stringContaining("custom/dir"));
        expect(runCodegenMock).not.toHaveBeenCalled();
        expect(collectLogged(state.logSpy)).toContain("regenerated stale bindings");
    });

    it("reports up to date when nothing was regenerated", async () => {
        ensureGeneratedMock.mockResolvedValueOnce(false);

        await run({});

        expect(collectLogged(state.logSpy)).toContain("bindings up to date");
    });
});

describe("codegen command (--force)", () => {
    const state = setupLogState();

    it("wipes and regenerates, reporting config, libraries, gir path, and totals", async () => {
        await run({ force: true, cwd: "/custom/dir" });

        expect(runCodegenMock).toHaveBeenCalledWith({
            cwd: expect.stringContaining("custom/dir"),
            force: true,
        });
        expect(ensureGeneratedMock).not.toHaveBeenCalled();

        const logged = collectLogged(state.logSpy);
        expect(logged).toContain("config=/project/gtkx.config.ts");
        expect(logged).toContain("libraries=Gtk-4.0, Adw-1");
        expect(logged).toContain("girPath=/usr/share/gir-1.0");
        expect(logged).toContain("2 namespaces, 142 widgets in 250ms");
    });

    it("skips optional log lines when fields are missing from the result", async () => {
        runCodegenMock.mockResolvedValueOnce({
            namespaces: 0,
            widgets: 0,
            duration: 5,
        } as never);

        await run({ force: true });

        const logged = collectLogged(state.logSpy);
        expect(logged).not.toContain("config=");
        expect(logged).not.toContain("libraries=");
        expect(logged).not.toContain("girPath=");
        expect(logged).toContain("0 namespaces, 0 widgets in 5ms");
    });
});
