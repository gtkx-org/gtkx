import * as Gtk from "@gtkx/gi/gtk";
import { render } from "@gtkx/react";
import { App } from "./app.js";

const app = new Gtk.Application({ applicationId: "com.gtkx.hello-world" });
render(<App />, app);
