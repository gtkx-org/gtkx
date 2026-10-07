import * as Gio from "@gtkx/gi/gio";

const createUniqueApplication = (applicationId: string): Gio.Application => {
    const application = new Gio.Application({
        applicationId,
        flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    application.on("activate", (): void => undefined);

    return application;
};

export { createUniqueApplication };
