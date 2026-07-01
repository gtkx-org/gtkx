import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/codegen/run-codegen.js", () => ({
    ensureGenerated: vi.fn(async () => true),
    isCodegenDisabled: vi.fn(async () => false),
    syncSchemaEnv: vi.fn(),
    runCodegen: vi.fn(async () => ({
        configFile: "/project/gtkx.config.ts",
        girPath: ["/usr/share/gir-1.0"],
        libraries: ["Gtk-4.0", "Adw-1"],
        namespaces: 2,
        intrinsicElements: 142,
        duration: 250,
    })),
}));

import { ensureGenerated, isCodegenDisabled, runCodegen, syncSchemaEnv } from "../../src/codegen/run-codegen.js";
import { codegen } from "../../src/commands/codegen.js";

const runCodegenMock = vi.mocked(runCodegen);
const ensureGeneratedMock = vi.mocked(ensureGenerated);
const isCodegenDisabledMock = vi.mocked(isCodegenDisabled);
const syncSchemaEnvMock = vi.mocked(syncSchemaEnv);

type CodegenArgs = { force?: boolean; cwd?: string };
type CodegenRun = NonNullable<typeof codegen.run>;
type CodegenContext = Parameters<CodegenRun>[0];

const run = (overrides: CodegenArgs): Promise<unknown> => {
    const handler = codegen.run;
    if (!handler) throw new Error("codegen command has no run handler");
    const args = { force: false, ...overrides } as CodegenContext["args"];
    return Promise.resolve(handler({ rawArgs: [], args, cmd: codegen }));
};

type LogState = { stderrSpy: ReturnType<typeof vi.spyOn> };

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

const collectLogged = (stderrSpy: ReturnType<typeof vi.spyOn>): string =>
    stderrSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("");

describe("codegen command (default — conditional)", () => {
    const state = setupLogState();

    it("delegates to ensureGenerated and reports a regeneration", async () => {
        await run({ cwd: "/custom/dir" });

        expect(ensureGeneratedMock).toHaveBeenCalledWith(expect.stringContaining("custom/dir"));
        expect(runCodegenMock).not.toHaveBeenCalled();
        expect(collectLogged(state.stderrSpy)).toContain("regenerated stale bindings");
    });

    it("reports up to date when nothing was regenerated", async () => {
        ensureGeneratedMock.mockResolvedValueOnce(false);

        await run({});

        expect(collectLogged(state.stderrSpy)).toContain("bindings up to date");
    });

    it("cleans up and reports a shared store when codegen is disabled", async () => {
        isCodegenDisabledMock.mockResolvedValueOnce(true);

        await run({ force: true, cwd: "/custom/dir" });

        expect(runCodegenMock).toHaveBeenCalledWith({ cwd: expect.stringContaining("custom/dir") });
        expect(ensureGeneratedMock).not.toHaveBeenCalled();
        expect(collectLogged(state.stderrSpy)).toContain("reusing an installed binding store");
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
        expect(syncSchemaEnvMock).toHaveBeenCalledWith(expect.stringContaining("custom/dir"));
        expect(ensureGeneratedMock).not.toHaveBeenCalled();

        const logged = collectLogged(state.stderrSpy);
        expect(logged).toContain("config=/project/gtkx.config.ts");
        expect(logged).toContain("libraries=Gtk-4.0, Adw-1");
        expect(logged).toContain("girPath=/usr/share/gir-1.0");
        expect(logged).toContain("2 namespaces, 142 intrinsic elements in 250ms");
    });

    it("skips optional log lines when fields are missing from the result", async () => {
        runCodegenMock.mockResolvedValueOnce({
            namespaces: 0,
            intrinsicElements: 0,
            duration: 5,
        } as never);

        await run({ force: true });

        const logged = collectLogged(state.stderrSpy);
        expect(logged).not.toContain("config=");
        expect(logged).not.toContain("libraries=");
        expect(logged).not.toContain("girPath=");
        expect(logged).toContain("0 namespaces, 0 intrinsic elements in 5ms");
    });
});
