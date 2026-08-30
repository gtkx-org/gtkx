import * as Gio from "@gtkx/gi/gio";
import { createApplication as deriveApplication } from "@gtkx/runtime";

const createUniqueApplication = (applicationId: string): Gio.Application => {
    const application = deriveApplication(Gio.Application, {
        applicationId,
        flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    application.on("activate", (): void => undefined);

    return application;
};

export { createUniqueApplication };
