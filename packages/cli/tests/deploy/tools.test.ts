import { tryResolveExecutable, warn } from "@gtkx/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeployTool } from "../../src/deploy/types.js";
import {
    APPSTREAMCLI,
    assertTools,
    DESKTOP_FILE_VALIDATE,
    FILE_TOOL,
    FLATPAK,
    FLATPAK_BUILDER,
    FLATPAK_NODE_GENERATOR,
    probeTools,
    STRIP,
    TAR,
    warnMissingOptional,
} from "../../src/deploy/tools.js";

const ABSENT_COMMAND = "gtkx-tool-that-cannot-exist";

const tool = (overrides: Partial<DeployTool> = {}): DeployTool => ({
    command: ABSENT_COMMAND,
    purpose: "does something useful",
    isOptional: false,
    isPresent: () => false,
    ...overrides,
});

const missingTool = (command: string, isOptional = false): DeployTool =>
    tool({ command, purpose: `handles ${command}`, isOptional });

const pathTool = (command: string): DeployTool => ({
    command,
    purpose: `handles ${command}`,
    isOptional: false,
});

const messageFor = (tools: DeployTool[]): string => {
    try {
        assertTools(probeTools(tools));
    } catch (error) {
        return error instanceof Error ? error.message : "";
    }

    return "";
};

const warnings = (): string[] => vi.mocked(warn).mock.calls.map((call) => call[0]);

const flatpakBuilderPresence = (builder: string | undefined, flatpak: string | undefined): boolean | undefined => {
    vi.mocked(tryResolveExecutable)
        .mockImplementationOnce(() => builder)
        .mockImplementationOnce(() => flatpak);

    return FLATPAK_BUILDER.isPresent?.();
};

vi.mock("@gtkx/utils", async (importOriginal) => {
    const original = await importOriginal<typeof import("@gtkx/utils")>();

    return { ...original, tryResolveExecutable: vi.fn(original.tryResolveExecutable), warn: vi.fn() };
});

beforeEach(() => {
    vi.mocked(warn).mockReset();
    vi.mocked(tryResolveExecutable).mockReset();
});

describe("probeTools", () => {
    it("reports nothing missing for an empty list", () => {
        expect(probeTools([])).toEqual({ missingRequired: [], missingOptional: [] });
    });

    it("splits the missing tools into required and optional", () => {
        const report = probeTools([missingTool("one"), missingTool("two", true)]);
        expect(report.missingRequired.map((entry) => entry.command)).toEqual(["one"]);
        expect(report.missingOptional.map((entry) => entry.command)).toEqual(["two"]);
    });

    it("leaves out a tool whose presence check passes", () => {
        const report = probeTools([tool({ isPresent: () => true })]);
        expect(report.missingRequired).toEqual([]);
        expect(report.missingOptional).toEqual([]);
    });

    it("keeps an optional tool whose presence check passes out of the report", () => {
        const report = probeTools([tool({ command: "strip", isOptional: true, isPresent: () => true })]);
        expect(report.missingOptional).toEqual([]);
    });
});

describe("probeTools: resolving a command", () => {
    it("resolves a bare command on PATH when the tool has no presence check", () => {
        const report = probeTools([pathTool(ABSENT_COMMAND)]);
        expect(report.missingRequired.map((entry) => entry.command)).toEqual([ABSENT_COMMAND]);
    });

    it("treats an absolute command as present", () => {
        const report = probeTools([pathTool("/opt/gtkx/packager")]);
        expect(report.missingRequired).toEqual([]);
    });

    it("probes a repeated command only once", () => {
        const first = vi.fn(() => true);
        const second = vi.fn(() => false);
        const report = probeTools([tool({ isPresent: first }), tool({ isPresent: second })]);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        expect(report.missingRequired).toHaveLength(1);
    });

    it("keeps the last tool declared for a repeated command", () => {
        const report = probeTools([missingTool(ABSENT_COMMAND), missingTool(ABSENT_COMMAND, true)]);
        expect(report.missingRequired).toEqual([]);
        expect(report.missingOptional).toHaveLength(1);
    });
});

describe("assertTools", () => {
    it("throws when a required tool is missing", () => {
        expect(() => {
            assertTools(probeTools([missingTool("one")]));
        }).toThrow("Cannot deploy");
    });

    it("does not throw when only optional tools are missing", () => {
        expect(() => {
            assertTools(probeTools([missingTool("one", true)]));
        }).not.toThrow();
    });

    it("does not throw when nothing is missing", () => {
        expect(() => {
            assertTools(probeTools([]));
        }).not.toThrow();
    });

    it("counts a single missing tool in the singular", () => {
        expect(messageFor([missingTool("one")])).toContain("1 required tool is missing");
    });

    it("counts several missing tools in the plural", () => {
        expect(messageFor([missingTool("one"), missingTool("two")])).toContain("2 required tools are missing");
    });

    it("mentions narrowing the run with --target", () => {
        expect(messageFor([missingTool("one")])).toContain(
            "Narrow the run with --target if you do not need every package format.",
        );
    });
});

describe("assertTools: the message body", () => {
    it("names every missing required tool", () => {
        const message = messageFor([missingTool("one"), missingTool("two")]);
        expect(message).toContain("one");
        expect(message).toContain("two");
    });

    it("states what each missing tool is for", () => {
        expect(messageFor([missingTool("one")])).toContain("handles one");
    });

    it("pads the purpose into its own column", () => {
        expect(messageFor([missingTool("one")])).toContain(`  ${"one".padEnd(26)}handles one`);
    });

    it("leaves the missing optional tools out of the message", () => {
        const message = messageFor([missingTool("one"), missingTool("shrinker", true)]);
        expect(message).not.toContain("shrinker");
    });

    it("adds the extra install hint for a tool that distributions do not package", () => {
        expect(messageFor([{ ...FLATPAK_NODE_GENERATOR, isPresent: () => false }])).toContain("pipx install");
    });

    it("indents the install hints under the purpose column", () => {
        const message = messageFor([{ ...FLATPAK_NODE_GENERATOR, isPresent: () => false }]);
        expect(message).toContain(`\n  ${"".padEnd(26)}pipx install`);
    });
});

describe("warnMissingOptional", () => {
    it("warns once for each missing optional tool", () => {
        warnMissingOptional(probeTools([missingTool("one", true), missingTool("two", true)]));
        expect(warnings()).toHaveLength(2);
    });

    it("names the tool and what it would have done", () => {
        warnMissingOptional(probeTools([missingTool("shrinker", true)]));
        expect(warnings()[0]).toBe("shrinker is not installed: it handles shrinker");
    });

    it("stays quiet about the missing required tools", () => {
        warnMissingOptional(probeTools([missingTool("one")]));
        expect(warnings()).toEqual([]);
    });

    it("stays quiet when every optional tool is present", () => {
        warnMissingOptional(probeTools([tool({ isOptional: true, isPresent: () => true })]));
        expect(warnings()).toEqual([]);
    });
});

describe("the declared tools", () => {
    it("names the command each tool runs", () => {
        expect(APPSTREAMCLI.command).toBe("appstreamcli");
        expect(DESKTOP_FILE_VALIDATE.command).toBe("desktop-file-validate");
        expect(FILE_TOOL.command).toBe("file");
        expect(FLATPAK.command).toBe("flatpak");
        expect(FLATPAK_BUILDER.command).toBe("flatpak-builder");
        expect(FLATPAK_NODE_GENERATOR.command).toBe("flatpak-node-generator");
        expect(TAR.command).toBe("tar");
    });

    it("treats stripping the runtime as the only optional step", () => {
        const required = [APPSTREAMCLI, DESKTOP_FILE_VALIDATE, FILE_TOOL, FLATPAK, FLATPAK_NODE_GENERATOR, TAR];
        expect(STRIP.isOptional).toBe(true);
        expect(required.every((entry) => entry.isOptional)).toBe(false);
        expect(required.some((entry) => entry.isOptional)).toBe(false);
    });

    it("explains what every tool is for", () => {
        const all = [APPSTREAMCLI, DESKTOP_FILE_VALIDATE, FILE_TOOL, FLATPAK, FLATPAK_BUILDER, STRIP, TAR];
        expect(all.every((entry) => entry.purpose.length > 0)).toBe(true);
    });

    it("leaves the other tools to a plain PATH lookup", () => {
        const others = [APPSTREAMCLI, DESKTOP_FILE_VALIDATE, FILE_TOOL, FLATPAK, FLATPAK_NODE_GENERATOR, STRIP, TAR];
        expect(others.every((entry) => entry.isPresent === undefined)).toBe(true);
    });
});

describe("the flatpak-builder presence check", () => {
    it("accepts a flatpak-builder binary on PATH without asking flatpak", () => {
        expect(flatpakBuilderPresence("/usr/bin/flatpak-builder", undefined)).toBe(true);
    });

    it("accepts flatpak-builder when flatpak reports the ref as installed", () => {
        expect(flatpakBuilderPresence(undefined, "/bin/true")).toBe(true);
    });

    it("rejects flatpak-builder when flatpak does not know the ref", () => {
        expect(flatpakBuilderPresence(undefined, "/bin/false")).toBe(false);
    });

    it("rejects flatpak-builder when flatpak itself is missing", () => {
        expect(flatpakBuilderPresence(undefined, undefined)).toBe(false);
    });
});
