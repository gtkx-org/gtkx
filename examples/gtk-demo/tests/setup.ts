import { afterEach } from "vitest";

const runSetup = async (): Promise<void> => {
    const { configure } = await import("@gtkx/testing");
    configure({ asyncUtilTimeout: 5000 });
};

const runCleanup = async (): Promise<void> => {
    const { cleanup } = await import("@gtkx/testing");
    await cleanup();
};

await runSetup();
afterEach(runCleanup);
