import { posix } from "node:path";
import type { DeploySettings } from "../types.js";
import { renderIni } from "./ini.js";

const SERVICE_GROUP = "D-BUS Service";
const SERVICE_FLAG = "--gapplication-service";

const renderDbusService = (settings: DeploySettings, prefix: string): string =>
    renderIni([
        {
            name: SERVICE_GROUP,
            entries: [
                ["Name", settings.applicationId],
                ["Exec", `${posix.join(prefix, "bin", settings.binaryName)} ${SERVICE_FLAG}`],
            ],
        },
    ]);

export { renderDbusService };
