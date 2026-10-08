import type { WrapperClass } from "@gtkx/runtime";
import { wrapApplicationConstructor } from "../../gio/overrides/application.js";
import { Application as GeneratedApplication } from "../adw.js";

interface Application extends GeneratedApplication {}

/** The Adwaita application class, with GJS-compatible construction and asynchronous execution. */
const Application: WrapperClass<typeof GeneratedApplication, Application> =
    wrapApplicationConstructor(GeneratedApplication);

export { Application };
