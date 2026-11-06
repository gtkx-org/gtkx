import { setPrgname } from "@gtkx/gi/glib";
import { translationDomain } from "virtual:gtkx-config";
import { programName } from "./utils/program-name.js";

setPrgname(programName(translationDomain));
