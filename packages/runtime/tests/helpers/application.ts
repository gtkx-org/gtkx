import * as Gio from "@gtkx/gi/gio";
import { createAppIdFactory } from "./unique-name.js";

type ApplicationSignal = "activate" | "shutdown";

const uniqueAppId = createAppIdFactory("org.gtkx.application");

const applicationProps = (): Gio.ApplicationConstructorProps => ({
    applicationId: uniqueAppId(),
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});

const createApplicationFrom = <T extends Gio.Application>(base: new (props: Gio.ApplicationConstructorProps) => T): T =>
    new base(applicationProps());

const createApplication = (): Gio.Application => createApplicationFrom(Gio.Application);

const createUniqueApplication = (applicationId: string): Gio.Application => {
    const application = new Gio.Application({
        applicationId,
        flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    application.on("activate", (): void => undefined);

    return application;
};

const countSignal = (application: Gio.Application, signal: ApplicationSignal): (() => number) => {
    let emissions = 0;

    application.on(signal, () => {
        emissions += 1;
    });

    return () => emissions;
};

export { applicationProps, countSignal, createApplication, createApplicationFrom, createUniqueApplication };
