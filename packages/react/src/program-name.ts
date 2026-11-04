import { setPrgname } from "@gtkx/gi/glib";
import { applicationId } from "virtual:gtkx-config";
import { programName } from "./utils/program-name.js";

setPrgname(programName(applicationId));
