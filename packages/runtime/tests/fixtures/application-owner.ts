import type * as Gio from "@gtkx/gi/gio";
import { runApplication } from "@gtkx/runtime";
import { createUniqueApplication } from "../helpers/application.js";

const HOLD_INTERVAL_MS = 250;

const requireRegistration = (application: Gio.Application): void => {
    if (application.getIsRegistered()) {
        return;
    }

    throw new Error("the owner lost the application ID it took");
};

const holdApplication = (application: Gio.Application): void => {
    setInterval(() => {
        requireRegistration(application);
    }, HOLD_INTERVAL_MS);
};

const ownApplicationId = (applicationId: string): void => {
    const application = createUniqueApplication(applicationId);
    const { isPrimary } = runApplication(application, ["owner"]);
    process.stdout.write(`OWNER isPrimary=${String(isPrimary)}\n`);
    holdApplication(application);
};

ownApplicationId(process.argv[2] ?? "");
