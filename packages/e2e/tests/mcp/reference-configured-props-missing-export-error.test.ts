import { describe, it } from "vitest";
import {
    expectConfiguredPropsRejection,
    type InvalidProps,
} from "./reference-configured-props-errors.js";
import { PROPS_MODULE, referenceSession } from "./reference-session.js";

const INVALID_PROPS: InvalidProps = { module: PROPS_MODULE, exported: "MissingProps" };
const session = referenceSession();

describe("reference configuration updates", () => {
    it("rejects configured props from a missing export", () =>
        expectConfiguredPropsRejection(session, INVALID_PROPS));
});
