import { onExit, quit } from "@gtkx/runtime";
import { keepAlive } from "@gtkx/runtime/internal";

const held = process.argv[2] === "held";
let completed = false;
onExit(() => {
    process.stdout.write(completed ? "COMPLETED\n" : "RELEASED\n");
});
keepAlive(held);
setTimeout(() => {
    completed = true;
    keepAlive(false);
    quit();
}, 50).unref();
