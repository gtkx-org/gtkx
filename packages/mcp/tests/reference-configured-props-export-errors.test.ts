import { describe, it } from "vitest";
import {
    expectConfiguredPropsRejection,
    type InvalidProps,
} from "./reference-configured-props-errors.js";
import { PROPS_MODULE, referenceSession } from "./reference-session.js";

const INVALID_PROPS: InvalidProps[] = [
    { title: "a value-only export", module: PROPS_MODULE, exported: "ValueProps" },
    { title: "a function export", module: PROPS_MODULE, exported: "FunctionProps" },
];
const session = referenceSession();

describe("reference configuration updates", () => {
    it.each(INVALID_PROPS)(
        "rejects configured props from $title",
        (invalidProps) => expectConfiguredPropsRejection(session, invalidProps),
    );
});
