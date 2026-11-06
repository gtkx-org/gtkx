import {
    connectSignal,
    type ExternalObject,
    getHandle,
    type Handle,
    keepAlive,
    quit,
    registerWrapperClass,
    resolveType,
    t,
    toClosure,
    wrapHandle,
} from "@gtkx/runtime";

const gst = "libgstreamer-1.0.so.0";
const glib = "libglib-2.0.so.0";
const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const MESSAGE_EOS = 1;

class Element {}
class Bus {}

const reportHandlerRan = (): void => {
    process.stdout.write("HANDLER RAN\n");
};

const init = t.bind(gst, "gst_init", [t.buffer, t.buffer], t.void);
init(null, null);
registerWrapperClass(Element, resolveType(gst, "gst_element_get_type"));
registerWrapperClass(Bus, resolveType(gst, "gst_bus_get_type"));

const parseLaunch = t.bind(gst, "gst_parse_launch", [t.string(), t.buffer], t.object("full"));
const getByName = t.bind(gst, "gst_bin_get_by_name", [t.object(), t.string()], t.object("full"));
const getBus = t.bind(gst, "gst_element_get_bus", [t.object()], t.object("full"));
const setState = t.bind(gst, "gst_element_set_state", [t.object(), t.int32], t.int32);
const popFiltered = t.bind(
    gst,
    "gst_bus_timed_pop_filtered",
    [t.object(), t.biguint64, t.uint32],
    t.struct("full", { sharedLibrary: gst, freeFnName: "gst_mini_object_unref" }),
);
const connectClosure = t.bind(
    "libgobject-2.0.so.0",
    "g_signal_connect_closure",
    [t.object(), t.string(), t.boxed("GClosure", { sharedLibrary: "libgobject-2.0.so.0", getTypeFnName: "g_closure_get_type" }), t.boolean],
    t.biguint64,
);
const newThread = t.bind(
    glib,
    "g_thread_new",
    [t.string(), t.callback([t.buffer], t.buffer, { hasUserData: true, userDataIndex: 0, scope: "async" })],
    t.buffer,
);
const joinThread = t.bind(glib, "g_thread_join", [t.buffer], t.buffer);

const pipeline = wrapHandle(
    parseLaunch("fakesrc num-buffers=2 ! identity name=identity ! fakesink name=sink signal-handoffs=true", null) as
        ExternalObject<Handle>,
);
const identity = wrapHandle(getByName(getHandle(pipeline), "identity") as ExternalObject<Handle>);
const sink = wrapHandle(getByName(getHandle(pipeline), "sink") as ExternalObject<Handle>);

connectClosure(getHandle(identity), "handoff", toClosure(reportHandlerRan), false);
connectSignal(sink, "handoff", {
    callback: t.callback([t.object(), t.buffer, t.object(), t.void], t.void, {
        scope: "notified",
        hasUserData: true,
        userDataIndex: 3,
        hasDestroy: true,
        destroyKind: "closureNotify",
    }),
    handler: reportHandlerRan,
    isAfter: false,
});

const bus = wrapHandle(getBus(getHandle(pipeline)) as ExternalObject<Handle>);
setState(getHandle(pipeline), 4);
const eos = popFiltered(getHandle(bus), 10n * NANOSECONDS_PER_SECOND, MESSAGE_EOS);
process.stdout.write(eos === null ? "NO EOS\n" : "EOS\n");
setState(getHandle(pipeline), 1);

const thread = newThread("gtkx-foreign-thread", () => {
    reportHandlerRan();
    return null;
});
process.stdout.write(`THREAD RETURNED ${String(joinThread(thread))}\n`);

keepAlive(true);
setTimeout(() => {
    process.stdout.write("STILL RUNNING\n");
    keepAlive(false);
    quit();
}, 200);
