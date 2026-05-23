import { afterEach } from "vitest";

const runCleanup = async (): Promise<void> => {
    const { cleanup } = await import("@gtkx/testing");
    await cleanup();
};

afterEach(runCleanup);
