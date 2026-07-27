type TestingModule = typeof import("@gtkx/testing");
type TestingModuleLoader = () => Promise<TestingModule>;

let loader: TestingModuleLoader = defaultLoader;
let testingModule: TestingModule | null = null;
let testingLoadError: Error | null = null;

function defaultLoader(): Promise<TestingModule> {
    return import("@gtkx/testing");
}

const setTestingModuleLoader = (next: TestingModuleLoader | null): void => {
    loader = next ?? defaultLoader;
    testingModule = null;
    testingLoadError = null;
};

const loadTestingModule = async (): Promise<TestingModule> => {
    if (testingModule) return testingModule;
    if (testingLoadError) throw testingLoadError;

    try {
        testingModule = await loader();

        return testingModule;
    } catch (error) {
        testingLoadError = new Error(
            "@gtkx/testing is not installed, install it to enable MCP widget interactions: " +
            `pnpm add -D @gtkx/testing (import failed: ${String(error)})`,
            { cause: error },
        );

        throw testingLoadError;
    }
};

export { setTestingModuleLoader, loadTestingModule, type TestingModule, type TestingModuleLoader };
