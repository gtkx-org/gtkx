import { execFileSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCliTool } from "../../src/internal/run-cli-tool.js";

const execFileSyncMock = vi.mocked(execFileSync);

const childProcessError = (stderr: string): Error => Object.assign(new Error("Command failed"), { stderr });

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

describe("runCliTool", () => {
    beforeEach(() => {
        execFileSyncMock.mockReset();
    });

    it("reports a missing executable as a lookup failure, not a run failure", () => {
        expect(() => {
            runCliTool({ tool: "definitely-not-a-gtkx-tool", args: [] });
        }).toThrow('Cannot find the "definitely-not-a-gtkx-tool" executable on PATH');

        expect(execFileSyncMock).not.toHaveBeenCalled();
    });

    it("resolves the tool to an absolute path before running it", () => {
        runCliTool({ tool: "sh", args: ["-c", "true"] });
        const [executable] = execFileSyncMock.mock.calls[0] ?? [];
        expect(executable).toMatch(/\/sh$/);
    });

    it("wraps a non-zero exit with the tool name, the target and the captured output", () => {
        execFileSyncMock.mockImplementation(() => {
            throw childProcessError("boom");
        });

        expect(() => {
            runCliTool({ tool: "sh", args: [], target: "the manifest" });
        }).toThrow("sh failed for the manifest:\nboom");
    });

    it("omits the target when none is given", () => {
        execFileSyncMock.mockImplementation(() => {
            throw childProcessError("boom");
        });

        expect(() => {
            runCliTool({ tool: "sh", args: [] });
        }).toThrow("sh failed:\nboom");
    });

    it("inherits stdio when streaming is requested", () => {
        runCliTool({ tool: "sh", args: [], shouldStream: true, options: { cwd: "/tmp" } });
        const options = (execFileSyncMock.mock.calls[0] ?? [])[2];
        expect(options).toEqual({ cwd: "/tmp", stdio: "inherit" });
    });

    it("passes the given options through when not streaming", () => {
        runCliTool({ tool: "sh", args: [], options: { cwd: "/tmp" } });
        const options = (execFileSyncMock.mock.calls[0] ?? [])[2];
        expect(options).toEqual({ cwd: "/tmp" });
    });
});
