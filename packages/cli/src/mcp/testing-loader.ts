type TestingModule = typeof import("@gtkx/testing");

export type TestingModuleLoader = () => Promise<TestingModule>;

const defaultLoader: TestingModuleLoader = () => import("@gtkx/testing");

let loader: TestingModuleLoader = defaultLoader;
let testingModule: TestingModule | null = null;
let testingLoadError: Error | null = null;

export const setTestingModuleLoader = (next: TestingModuleLoader | null): void => {
    loader = next ?? defaultLoader;
    testingModule = null;
    testingLoadError = null;
};

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
