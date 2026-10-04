import { describe, it } from "vitest";
import {
    expectConfiguredPropsRejection,
    type InvalidProps,
} from "./reference-configured-props-errors.js";
import { PROPS_MODULE, referenceSession } from "./reference-session.js";

const INVALID_PROPS: InvalidProps = { module: PROPS_MODULE, exported: "ValueProps" };
const session = referenceSession();

describe("reference configuration updates", () => {
    it("rejects configured props from a value-only export", () =>
        expectConfiguredPropsRejection(session, INVALID_PROPS));
});
