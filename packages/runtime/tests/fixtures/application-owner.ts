import { runApplication } from "@gtkx/runtime";
import { createUniqueApplication } from "../helpers/application.js";

const application = createUniqueApplication(process.argv[2] ?? "");
const { isPrimary } = runApplication(application, ["owner"]);
process.stdout.write(`OWNER isPrimary=${String(isPrimary)}\n`);
