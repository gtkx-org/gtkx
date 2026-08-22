import { finalize, init } from "@gtkx/gi/gtksource";
import { onExit } from "@gtkx/runtime";

onExit(finalize);
init();
