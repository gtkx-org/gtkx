import { describe, it } from "vitest";
import {
    expectConfiguredPropsRejection,
    type InvalidProps,
} from "./reference-configured-props-errors.js";
import { referenceSession } from "./reference-session.js";

const INVALID_PROPS: InvalidProps = { module: "@audit/not-installed", exported: "Props" };
const session = referenceSession();

describe("reference configuration updates", () => {
    it("rejects configured props from an uninstalled package", () =>
        expectConfiguredPropsRejection(session, INVALID_PROPS));
});
