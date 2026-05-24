import { afterEach, beforeAll } from "vitest";

beforeAll(async () => {
    const { configure } = await import("@gtkx/testing");
    configure({ asyncUtilTimeout: 5000 });
});

const runCleanup = async (): Promise<void> => {
    const { cleanup } = await import("@gtkx/testing");
    await cleanup();
};

afterEach(runCleanup);
