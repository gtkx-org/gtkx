import { errorCode } from "@gtkx/utils";
import { readFileSync } from "node:fs";

const readOptionalText = (path: string): string | undefined => {
    try {
        return readFileSync(path, "utf8");
    } catch (error) {
        if (errorCode(error) === "ENOENT") {
            return undefined;
        }

        throw error;
    }
};

export { readOptionalText };
