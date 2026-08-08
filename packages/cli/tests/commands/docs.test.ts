import { resolveGirPath, resolveLibraries } from "@gtkx/codegen";
import { writeDocs } from "@gtkx/codegen/internal";
import { loadConfig } from "@gtkx/config";
import { describe, expect, it, vi } from "vitest";
import { docs } from "../../src/commands/docs.js";
import { collectLogged } from "../stderr-text.js";
import { setupLogState } from "./log-state.js";

type DocsArgs = { out?: string; "base-path"?: string; force?: boolean; cwd?: string };
type DocsRun = NonNullable<typeof docs.run>;
type DocsContext = Parameters<DocsRun>[0];

const writeDocsMock = vi.mocked(writeDocs);
const loadConfigMock = vi.mocked(loadConfig);
const resolveGirPathMock = vi.mocked(resolveGirPath);
const resolveLibrariesMock = vi.mocked(resolveLibraries);

const stringContaining = (expected: string): string => expect.stringContaining(expected) as string;

const docsCall = (overrides: Record<string, unknown>): Record<string, unknown> => ({
    libraries: ["Gtk-4.0"],
    girPath: ["/usr/share/gir-1.0"],
    props: {},
    omittedProps: {},
    ...overrides,
});

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

function mockedNamespaces() {
    return [
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
    ];
}

function mockedMergeOmittedProps(...maps: Record<string, string[]>[]): Record<string, string[]> {
    const merged: Record<string, string[]> = {};

    for (const map of maps) {
        Object.assign(merged, map);
    }

    return merged;
}

vi.mock("@gtkx/codegen", () => ({
    resolveGirPath: vi.fn(() => ["/usr/share/gir-1.0"]),
    resolveLibraries: vi.fn(() => ["Gtk-4.0"]),
    resolveStore: vi.fn(() => ({
        gi: { storeDir: "/project/node_modules/.gtkx/gi", linkDir: "", version: "0.0.0" },
        jsx: null,
        reactSubexports: [],
    })),
    mergeOmittedProps: vi.fn(mockedMergeOmittedProps),
    readBuiltinElements: vi.fn(() =>
        Promise.resolve({ components: {}, lazyElements: [], props: {}, omittedProps: {} })),
}));

vi.mock("@gtkx/codegen/internal", () => ({
    writeDocs: vi.fn(() => ({ isRegenerated: true, namespaces: mockedNamespaces() })),
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

        expect(writeDocsMock).toHaveBeenCalledWith(docsCall({
            outDir: stringContaining("custom/dir/docs/reference"),
            basePath: "/reference",
            isForced: false,
        }));

        expect(collectLogged(state.stderrSpy)).toContain("wrote 3 element pages across 2 namespaces");
    });

    it("passes out, base-path, and force through", async () => {
        loadConfigMock.mockResolvedValueOnce({
            config: { applicationId: "com.example.App" },
            configFile: "/project/gtkx.config.ts",
        } as never);

        await run({ cwd: "/custom/dir", out: "site/elements", "base-path": "/elements", force: true });

        expect(writeDocsMock).toHaveBeenCalledWith(docsCall({
            outDir: stringContaining("custom/dir/site/elements"),
            basePath: "/elements",
            isForced: true,
        }));
    });

    it("reports up to date when nothing was regenerated", async () => {
        writeDocsMock.mockReturnValueOnce({ isRegenerated: false, namespaces: [] });
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
