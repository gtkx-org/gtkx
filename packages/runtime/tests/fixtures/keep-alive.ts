import { keepAlive, onExit, quit } from "@gtkx/runtime";

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
