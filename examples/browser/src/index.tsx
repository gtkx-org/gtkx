import * as Gtk from "@gtkx/ffi/gtk";
import { render } from "@gtkx/react";
import { App } from "./app.js";

const app = new Gtk.Application({ applicationId: "com.gtkx.browser" });
render(<App />, app);
