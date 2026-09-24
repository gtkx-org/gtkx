import { describe, it } from "vitest";
import {
    expectConfiguredPropsRejection,
    type InvalidProps,
} from "./reference-configured-props-errors.js";
import { PROPS_MODULE, referenceSession } from "./reference-session.js";

const INVALID_PROPS: InvalidProps[] = [
    { title: "an uninstalled package", module: "@audit/not-installed", exported: "Props" },
    { title: "a missing export", module: PROPS_MODULE, exported: "MissingProps" },
];
const session = referenceSession();

describe("reference configuration updates", () => {
    it.each(INVALID_PROPS)(
        "rejects configured props from $title",
        (invalidProps) => expectConfiguredPropsRejection(session, invalidProps),
    );
});
