import * as Gtk from "@gtkx/gi/gtk";
import { render } from "@gtkx/react";
import { App } from "./app.js";

const app = new Gtk.Application({ applicationId: import.meta.env.GTKX_APPLICATION_ID });
render(<App />, app);
