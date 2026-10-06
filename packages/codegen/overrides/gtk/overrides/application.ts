import { Application as GioApplication } from "../../gio/gio.js";
import { updateApplicationActivity } from "../../gio/overrides/application.js";
import { Application } from "../gtk.js";

const observedApplications: WeakSet<Application> = new WeakSet();

Application.prototype.runAsync = function (argv: string[]): Promise<number> {
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
