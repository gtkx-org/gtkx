import * as Gio from "@gtkx/gi/gio";
import { createApplication as deriveApplication } from "@gtkx/runtime";
import { createAppIdFactory } from "./unique-name.js";

const uniqueAppId = createAppIdFactory("org.gtkx.application");

const applicationProps = (): Gio.ApplicationConstructorProps => ({
    applicationId: uniqueAppId(),
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});

const createApplication = (): Gio.Application => deriveApplication(Gio.Application, applicationProps());

const createUniqueApplication = (applicationId: string): Gio.Application => {
    const application = deriveApplication(Gio.Application, {
        applicationId,
        flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    application.on("activate", (): void => undefined);

    return application;
};

export { createApplication, createUniqueApplication };
