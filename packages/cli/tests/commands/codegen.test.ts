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

type CommandRun<Args extends Record<string, unknown>> = (ctx: { args: Args }) => Promise<unknown>;

type CodegenArgs = { clean?: boolean; "if-missing"?: boolean; cwd?: string };

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

describe("codegen command (forwarding)", () => {
    const state = setupLogState();

    it("forwards --clean and --cwd flags", async () => {
        const run = codegen.run as unknown as CommandRun<CodegenArgs>;

        await run({ args: { clean: true, cwd: "/custom/dir" } });

        expect(runCodegenMock).toHaveBeenCalledWith({
            cwd: expect.stringContaining("custom/dir"),
            clean: true,
        });
    });

    it("delegates to ensureGenerated and skips reporting with --if-missing", async () => {
        const run = codegen.run as unknown as CommandRun<CodegenArgs>;

        await run({ args: { "if-missing": true, cwd: "/custom/dir" } });

        expect(ensureGeneratedMock).toHaveBeenCalledWith(expect.stringContaining("custom/dir"));
        expect(runCodegenMock).not.toHaveBeenCalled();
    });

    it("stays silent with --if-missing when nothing was regenerated", async () => {
        ensureGeneratedMock.mockResolvedValueOnce(false);
        const run = codegen.run as unknown as CommandRun<CodegenArgs>;

        await run({ args: { "if-missing": true } });

        expect(collectLogged(state.logSpy)).toBe("");
    });
});

describe("codegen command (result reporting)", () => {
    const state = setupLogState();

    it("logs config, libraries, gir path, and totals after a successful run", async () => {
        const run = codegen.run as unknown as CommandRun<CodegenArgs>;

        await run({ args: {} });

        expect(runCodegenMock).toHaveBeenCalledWith({ cwd: process.cwd(), clean: undefined });

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
        const run = codegen.run as unknown as CommandRun<CodegenArgs>;

        await run({ args: {} });

        const logged = collectLogged(state.logSpy);
        expect(logged).not.toContain("config=");
        expect(logged).not.toContain("libraries=");
        expect(logged).not.toContain("girPath=");
        expect(logged).toContain("0 namespaces, 0 widgets in 5ms");
    });
});
