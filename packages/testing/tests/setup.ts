import { afterEach } from "vitest";

afterEach(async () => {
    const { cleanup } = await import("../src/index.js");
    await cleanup();
});
