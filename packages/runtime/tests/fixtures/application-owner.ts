import type * as Gio from "@gtkx/gi/gio";
import { createUniqueApplication } from "../helpers/application.js";

const HOLD_INTERVAL_MS = 250;

const requireRegistration = (application: Gio.Application): void => {
    if (application.getIsRegistered()) {
        return;
    }

    throw new Error("the owner lost the application ID it took");
};

const holdApplication = (application: Gio.Application): NodeJS.Timeout =>
    setInterval(() => {
        requireRegistration(application);
    }, HOLD_INTERVAL_MS).unref();

const ownApplicationId = async (applicationId: string): Promise<void> => {
    const application = createUniqueApplication(applicationId);
    const completion = application.runAsync(["owner"]);
    const isPrimary = application.getIsRegistered() && !application.getIsRemote();
    process.stdout.write(`OWNER isPrimary=${String(isPrimary)}\n`);
    const interval = holdApplication(application);

    try {
        process.exitCode = await completion;
    } finally {
        clearInterval(interval);
        application.quit();
    }
};

await ownApplicationId(process.argv[2] ?? "");
