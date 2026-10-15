import { keepAlive, onExit, quit } from "@gtkx/runtime";

const mode = process.argv[2];
let completed = false;
onExit(() => {
    process.stdout.write(completed ? "COMPLETED\n" : "RELEASED\n");
});
switch (mode) {
    case "held":
        keepAlive(true);
        break;
    case "released":
        keepAlive(false);
        break;
    case "repeated":
        keepAlive(true);
        keepAlive(true);
        keepAlive(false);
        break;
    case "toggled":
        keepAlive(true);
        keepAlive(false);
        keepAlive(false);
        keepAlive(true);
        break;
    case "after-quit":
        keepAlive(true);
        quit();
        keepAlive(false);
        keepAlive(true);
        break;
    default:
        throw new Error(`Unknown keep-alive fixture mode ${String(mode)}`);
}
setTimeout(() => {
    completed = true;
    keepAlive(false);
    quit();
}, 50).unref();
