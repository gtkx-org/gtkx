import * as Gio from "@gtkx/gi/gio";
import { deriveApplicationClass } from "@gtkx/runtime";
import { createAppIdFactory } from "./unique-name.js";

type ApplicationSignal = "activate" | "shutdown";

const DerivedApplication = deriveApplicationClass(Gio.Application) as typeof Gio.Application;
const uniqueAppId = createAppIdFactory("org.gtkx.application");

const applicationProps = (): Gio.ApplicationConstructorProps => ({
    applicationId: uniqueAppId(),
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});

const createApplication = (): Gio.Application => new DerivedApplication(applicationProps());
const createPlainApplication = (): Gio.Application => new Gio.Application(applicationProps());

const countSignal = (application: Gio.Application, signal: ApplicationSignal): (() => number) => {
    let emissions = 0;

    application.on(signal, () => {
        emissions += 1;
    });

    return () => emissions;
};

export { applicationProps, countSignal, createApplication, createPlainApplication, DerivedApplication };
