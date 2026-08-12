import * as Gio from "@gtkx/gi/gio";
import { type ApplicationClass, createApplication as deriveApplication } from "@gtkx/runtime";
import { createAppIdFactory } from "./unique-name.js";

type ApplicationSignal = "activate" | "shutdown";

const uniqueAppId = createAppIdFactory("org.gtkx.application");

const applicationProps = (): Gio.ApplicationConstructorProps => ({
    applicationId: uniqueAppId(),
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});

const createApplicationFrom = <T extends Gio.Application>(
    base: ApplicationClass<T, Gio.ApplicationConstructorProps>,
): T => deriveApplication(base, applicationProps());

const createApplication = (): Gio.Application => createApplicationFrom(Gio.Application);

const createUniqueApplication = (applicationId: string): Gio.Application => {
    const application = deriveApplication(Gio.Application, {
        applicationId,
        flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    application.on("activate", (): void => undefined);

    return application;
};

const createPlainApplication = (): Gio.Application => new Gio.Application(applicationProps());

const countSignal = (application: Gio.Application, signal: ApplicationSignal): (() => number) => {
    let emissions = 0;

    application.on(signal, () => {
        emissions += 1;
    });

    return () => emissions;
};

export {
    applicationProps,
    countSignal,
    createApplication,
    createApplicationFrom,
    createPlainApplication,
    createUniqueApplication,
};
