import { expect, type MockedFunction, vi } from "vitest";
import type { resolveCodegenContext } from "../../src/codegen/store-resolver.js";

type ConfigWatch = { paths: string[]; regenerate: () => Promise<void> };
type PreflightCall = [unknown, { shouldAnnounce: boolean; mode: string }];
type CodegenContextMock = MockedFunction<typeof resolveCodegenContext>;

const watchSentinel: ConfigWatch = { paths: ["/proj/gtkx.config.ts"], regenerate: () => Promise.resolve() };

const runCodegenMocks = () => ({
    ensureGeneratedIn: vi.fn(() => Promise.resolve(false)),
    resolveConfigWatch: vi.fn(() => Promise.resolve(watchSentinel)),
});

const storeResolverMocks = () => ({
    resolveCodegenContext: vi.fn((cwd: string) =>
        Promise.resolve({ root: cwd, config: { applicationId: "org.gtk.Test" }, configFile: "gtkx.config.ts" }),
    ),
});

const preflightCall = (root: string, mode: string): PreflightCall => [
    expect.objectContaining({ root }),
    { shouldAnnounce: true, mode },
];

const failNextConfigLoad = (mock: CodegenContextMock, root: string): string => {
    const message = `gtkx.config.ts: no configuration file found in ${root}`;
    mock.mockRejectedValueOnce(new Error(message));

    return message;
};

export { failNextConfigLoad, preflightCall, runCodegenMocks, storeResolverMocks, watchSentinel };
