import { wrapApplicationConstructor } from "../../gio/overrides/application.js";
import { Application as GeneratedApplication } from "../adw.js";

type Application = GeneratedApplication;

/** The Adwaita application class, with GJS-compatible construction and asynchronous execution. */
const Application: typeof GeneratedApplication = wrapApplicationConstructor(GeneratedApplication);

export { Application };
