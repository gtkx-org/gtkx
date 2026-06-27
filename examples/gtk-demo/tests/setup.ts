import { beforeAll } from "vitest";

beforeAll(async () => {
    const { configure } = await import("@gtkx/testing");
    configure({ asyncUtilTimeout: 5000 });
});
