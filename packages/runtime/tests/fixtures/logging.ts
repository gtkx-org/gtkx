const { keepAlive } = await import("@gtkx/runtime/internal");
const { quit, t } = await import("@gtkx/runtime");

const library = process.argv[2];
if (library === undefined) {
    throw new Error("The logging fixture needs the path of its native library");
}

const failNow = t.bind(library, "gtkx_fail_assertion", [], t.void);
const failLater = t.bind(library, "gtkx_fail_assertion_later", [], t.void);

failNow();
process.stdout.write("CALL RETURNED\n");

keepAlive(true);
failLater();
setTimeout(() => {
    process.stdout.write("STILL RUNNING\n");
    quit();
}, 200);
