import { events } from "@gtkx/ffi";
import * as GtkSource from "@gtkx/ffi/gtksource";
import { render } from "@gtkx/react";
import { App } from "./app.js";

events.on("start", () => {
    GtkSource.init();
});

events.on("stop", () => {
    GtkSource.finalize();
});

render(<App />, "org.gtkx.Demo");
