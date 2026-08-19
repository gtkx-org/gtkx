import { t } from "@gtkx/runtime";
import type { Status } from "./enums.js";
import { bindCairo } from "./lib.js";

const cairoVersion = bindCairo("cairo_version", [], t.int32);
const cairoVersionString = bindCairo("cairo_version_string", [], t.string("borrowed"));
const cairoStatusToString = bindCairo("cairo_status_to_string", [t.int32], t.string("borrowed"));

/** Returns the version of the cairo library in use, encoded as `major * 10000 + minor * 100 + micro`. */
const version = (): number => cairoVersion() as number;
/** Returns the version of the cairo library in use as a string such as `"1.18.2"`. */
const versionString = (): string => cairoVersionString() as string;
/** Returns a human-readable description of a status code. */
const statusToString = (status: Status): string => cairoStatusToString(status) as string;

export { statusToString, version, versionString };
