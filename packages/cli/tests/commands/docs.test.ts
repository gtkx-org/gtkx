import { resolveGirPath, resolveLibraries, writeDocs } from "@gtkx/codegen";
import { loadConfig } from "@gtkx/config";
import { describe, expect, it, vi } from "vitest";
import { docs } from "../../src/commands/docs.js";
import { collectLogged, setupLogState } from "./log-state.js";

type DocsArgs = { out?: string; "base-path"?: string; force?: boolean; cwd?: string };
type DocsRun = NonNullable<typeof docs.run>;
type DocsContext = Parameters<DocsRun>[0];

const writeDocsMock = vi.mocked(writeDocs);
const loadConfigMock = vi.mocked(loadConfig);
const resolveGirPathMock = vi.mocked(resolveGirPath);
const resolveLibrariesMock = vi.mocked(resolveLibraries);

const stringContaining = (expected: string): string => expect.stringContaining(expected) as string;

const run = (overrides: DocsArgs): Promise<unknown> => {
    const handler = docs.run;

    if (!handler) {
        throw new Error("docs command has no run handler");
    }

    const args = {
        out: "docs/reference",
        "base-path": "/reference",
        force: false,
        ...overrides,
    } as DocsContext["args"];

    return Promise.resolve(handler({ rawArgs: [], args, cmd: docs }));
};

vi.mock("@gtkx/codegen", () => ({
    resolveGirPath: vi.fn(() => ["/usr/share/gir-1.0"]),
    resolveLibraries: vi.fn(() => ["Gtk-4.0"]),
    readBuiltinElements: vi.fn(() => Promise.resolve({ components: {}, lazyElements: [], props: {} })),
    writeDocs: vi.fn(() => ({
        regenerated: true,
        namespaces: [
            {
                name: "Gtk",
                directory: "gtk",
                link: "/reference/gtk/",
                elements: [
                    { text: "GtkBox", link: "/reference/gtk/box" },
                    { text: "GtkButton", link: "/reference/gtk/button" },
                ],
            },
            {
                name: "Adw",
                directory: "adw",
                link: "/reference/adw/",
                elements: [{ text: "AdwHeaderBar", link: "/reference/adw/header-bar" }],
            },
        ],
    })),
}));

vi.mock("@gtkx/config", () => ({
    loadConfig: vi.fn(() =>
        Promise.resolve({
            config: { applicationId: "com.example.App", libraries: ["Gtk-4.0"] },
            configFile: "/project/gtkx.config.ts",
        }),
    ),
}));

describe("docs command", () => {
    const state = setupLogState();

    it("generates pages from the resolved config and reports totals", async () => {
        await run({ cwd: "/custom/dir" });
        expect(loadConfigMock).toHaveBeenCalledWith(expect.stringContaining("custom/dir"));
        expect(resolveLibrariesMock).toHaveBeenCalledWith(["Gtk-4.0"], ["/usr/share/gir-1.0"]);

        expect(writeDocsMock).toHaveBeenCalledWith({
            libraries: ["Gtk-4.0"],
            girPath: ["/usr/share/gir-1.0"],
            outDir: stringContaining("custom/dir/docs/reference"),
            basePath: "/reference",
            props: {},
            force: false,
        });

        expect(collectLogged(state.stderrSpy)).toContain("wrote 3 element pages across 2 namespaces");
    });

    it("passes out, base-path, and force through", async () => {
        loadConfigMock.mockResolvedValueOnce({
            config: { applicationId: "com.example.App" },
            configFile: "/project/gtkx.config.ts",
        } as never);

        await run({ cwd: "/custom/dir", out: "site/elements", "base-path": "/elements", force: true });

        expect(writeDocsMock).toHaveBeenCalledWith({
            libraries: ["Gtk-4.0"],
            girPath: ["/usr/share/gir-1.0"],
            outDir: stringContaining("custom/dir/site/elements"),
            basePath: "/elements",
            props: {},
            force: true,
        });
    });

    it("reports up to date when nothing was regenerated", async () => {
        writeDocsMock.mockReturnValueOnce({ regenerated: false, namespaces: [] });
        await run({});
        expect(collectLogged(state.stderrSpy)).toContain("up to date");
    });

    it("fails when codegen is disabled", async () => {
        loadConfigMock.mockResolvedValueOnce({
            config: { applicationId: "com.example.App", codegen: false },
            configFile: "/project/gtkx.config.ts",
        } as never);

        await expect(run({})).rejects.toThrow("codegen is disabled");
        expect(writeDocsMock).not.toHaveBeenCalled();
    });

    it("fails when no GIR search paths are available", async () => {
        resolveGirPathMock.mockReturnValueOnce([]);
        await expect(run({})).rejects.toThrow("No GIR search paths available");
        expect(writeDocsMock).not.toHaveBeenCalled();
    });
});
