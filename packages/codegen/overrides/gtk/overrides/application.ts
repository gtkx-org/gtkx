import { Application as GioApplication } from "../../gio/gio.js";
import { updateApplicationActivity, wrapApplicationConstructor } from "../../gio/overrides/application.js";
import { Application as GeneratedApplication } from "../gtk.js";

type Application = GeneratedApplication;

/** The GTK application class, with GJS-compatible construction and asynchronous execution. */
const Application: typeof GeneratedApplication = wrapApplicationConstructor(GeneratedApplication);

const observedApplications: WeakSet<Application> = new WeakSet();

Application.prototype.runAsync = function (argv: string[] | null): Promise<number> {
    if (!observedApplications.has(this)) {
        observedApplications.add(this);
        const receiver = new WeakRef(this);
        const updateActivity = (): void => {
            const application = receiver.deref();

            if (application) {
                updateApplicationActivity(application);
            }
        };
        this.on("window-added", updateActivity);
        this.on("window-removed", updateActivity);
    }

    updateApplicationActivity(this);

    return GioApplication.prototype.runAsync.call(this, argv);
};

export { Application };
