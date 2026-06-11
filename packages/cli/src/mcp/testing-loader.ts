type TestingModule = typeof import("@gtkx/testing");

/**
 * Produces the `@gtkx/testing` module instance the MCP handlers drive the
 * app with.
 */
export type TestingModuleLoader = () => Promise<TestingModule>;

const defaultLoader: TestingModuleLoader = () => import("@gtkx/testing");

let loader: TestingModuleLoader = defaultLoader;
let testingModule: TestingModule | null = null;
let testingLoadError: Error | null = null;

/**
 * Installs the loader {@link loadTestingModule} resolves `@gtkx/testing`
 * with, clearing any cached module or failure.
 *
 * The dev runner installs a loader backed by the Vite dev server, so the
 * testing module joins the app's own module graph and drives the same
 * `@gtkx/react` instance the app rendered with; the default loader is a
 * plain dynamic import. Passing `null` restores the default.
 *
 * @param next - The loader to install, or `null` to restore the default.
 */
export const setTestingModuleLoader = (next: TestingModuleLoader | null): void => {
    loader = next ?? defaultLoader;
    testingModule = null;
    testingLoadError = null;
};

/**
 * Lazily loads `@gtkx/testing` through the installed loader, caching either
 * the loaded module or the failure.
 *
 * `@gtkx/testing` is an optional peer dependency. Calling code reaches it
 * only when handling MCP traffic, so resolving the import on demand keeps
 * the startup cost zero for apps that never connect to an MCP server.
 *
 * @throws An error explaining how to install `@gtkx/testing` if the module
 *   resolution fails, carrying the underlying failure as its cause.
 */
export const loadTestingModule = async (): Promise<TestingModule> => {
    if (testingModule) return testingModule;
    if (testingLoadError) throw testingLoadError;

    try {
        testingModule = await loader();
        return testingModule;
    } catch (cause) {
        testingLoadError = new Error(
            "@gtkx/testing is not installed, install it to enable MCP widget interactions: " +
                `pnpm add -D @gtkx/testing (import failed: ${String(cause)})`,
            { cause },
        );
        throw testingLoadError;
    }
};
