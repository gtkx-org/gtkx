import { bind } from "./bind.js";
import { objectT, voidT } from "./descriptors.js";
import { GIO_LIB } from "./library.js";
import { getHandle } from "./registry.js";

const readDefaultApplication = bind(GIO_LIB, "g_application_get_default", [], objectT("borrowed"));
const writeDefaultApplication = bind(GIO_LIB, "g_application_set_default", [objectT("borrowed")], voidT);

const claimDefaultApplication = (application: object): void => {
    writeDefaultApplication(getHandle(application));
};

const releaseDefaultApplication = (application: object): void => {
    if (readDefaultApplication() !== application) {
        return;
    }

    writeDefaultApplication(null);
};

export { claimDefaultApplication, releaseDefaultApplication };
