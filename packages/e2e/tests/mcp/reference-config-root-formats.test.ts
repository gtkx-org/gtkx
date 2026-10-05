import { describe, it } from "vitest";
import { expectProjectConfiguration } from "./reference-config-format.js";
import { referenceSession } from "./reference-session.js";

const { listApi } = referenceSession();

describe("reference configuration updates", () => {
    it.each(["gtkx.config.cjs", "gtkx.config.cts"])(
        "finds a project using %s from a child directory",
        (configuration) => expectProjectConfiguration(listApi, configuration),
    );
});
