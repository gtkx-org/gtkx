use std::panic::{self, AssertUnwindSafe};
use std::sync::OnceLock;
use std::sync::atomic::Ordering;
use std::sync::mpsc;
use std::thread::JoinHandle;

use parking_lot::Mutex;

use super::error_reporter::ErrorReporter;
use super::log_handler::GlibLogHandler;
use super::panic_handler::format_panic_payload;
use super::{GlibTask, Mailbox, send_or_report};

#[derive(Debug, Default)]
pub struct GlibThread {
    handle: Mutex<Option<JoinHandle<()>>>,
}

static GLIB_THREAD: OnceLock<GlibThread> = OnceLock::new();

impl GlibThread {
    pub fn global() -> &'static Self {
        GLIB_THREAD.get_or_init(Self::default)
    }

    pub fn set_handle(&self, handle: JoinHandle<()>) {
        let previous = self.handle.lock().replace(handle);
        if previous.is_some() {
            ErrorReporter::global()
                .report_str("GLib thread handle replaced while a previous thread was unjoined");
        }
    }

    pub fn join(&self) -> Option<String> {
        let handle = self.handle.lock().take();

        if let Some(handle) = handle
            && let Err(payload) = handle.join()
        {
            return Some(format_panic_payload(&*payload));
        }
        None
    }

    /// Spawns the single gtkx-glib thread, runs its `GLib` main loop, and returns the loop handle
    /// once the thread signals readiness.
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn spawn(&self) -> napi::Result<glib::MainLoop> {
        let (tx, rx) = mpsc::channel::<glib::MainLoop>();

        let handle = std::thread::Builder::new()
            .name("gtkx-glib".to_owned())
            .spawn(move || {
                let result = panic::catch_unwind(AssertUnwindSafe(|| {
                    GlibLogHandler::install();

                    let main_loop = glib::MainLoop::new(None, false);
                    let main_loop_for_js = main_loop.clone();

                    glib::idle_add_once(move || {
                        send_or_report(
                            &tx,
                            main_loop_for_js,
                            "GLib main loop ready but startup channel was closed",
                        );
                    });

                    main_loop.run();
                }));

                if let Err(payload) = result {
                    ErrorReporter::global().report_str(&format!(
                        "GLib thread panicked: {}",
                        format_panic_payload(&*payload)
                    ));
                }
            })
            .map_err(|err| {
                napi::Error::new(
                    napi::Status::GenericFailure,
                    format!("Error spawning GLib thread: {err}"),
                )
            })?;

        self.set_handle(handle);

        rx.recv().map_err(|err| {
            let cause = self.join().unwrap_or_else(|| err.to_string());
            napi::Error::new(
                napi::Status::GenericFailure,
                format!("Error starting GLib thread: {cause}"),
            )
        })
    }
}

impl Mailbox {
    /// Enqueues a GLib-thread task tagged with the current `callback_depth`.
    ///
    /// The depth tag records the reentrancy frame that produced the task so that a nested wait
    /// only drains tasks at or below its own depth; see the module-level reentrancy invariant.
    fn push_glib_task(&self, task: GlibTask) {
        let depth = self.callback_depth.load(Ordering::Acquire);
        self.glib_inbox.lock().push_back((depth, task));
        self.freeze.notify_if_active();
        self.wake_glib.notify();
    }

    pub fn schedule_glib(&self, task: Box<dyn FnOnce() + Send + 'static>) {
        if !self.running.load(Ordering::Acquire) {
            return;
        }

        self.push_glib_task(task);

        if self.freeze.loop_active() {
            return;
        }

        glib::idle_add_full(glib::Priority::HIGH_IDLE, || {
            Self::global().dispatch_pending();
            glib::ControlFlow::Break
        });
    }

    pub fn dispatch_pending(&self) -> bool {
        self.dispatch_pending_from_depth(0)
    }

    /// Drains GLib-thread tasks tagged with `depth >= min_depth`, leaving shallower tasks queued.
    ///
    /// A nested wait passes its own `wait_depth` as `min_depth` so it only runs work enqueued at
    /// or below its frame and never re-enters a task belonging to an outer frame; see the
    /// module-level depth-tagged reentrancy invariant.
    pub fn dispatch_pending_from_depth(&self, min_depth: usize) -> bool {
        let mut dispatched = false;

        loop {
            let task = {
                let mut inbox = self.glib_inbox.lock();
                inbox
                    .iter()
                    .position(|(depth, _)| *depth >= min_depth)
                    .and_then(|index| inbox.remove(index))
            };

            match task {
                Some((_, task)) => {
                    if let Err(payload) = panic::catch_unwind(AssertUnwindSafe(task)) {
                        ErrorReporter::global().report_str(&format!(
                            "panic in GLib-thread task: {}",
                            format_panic_payload(&*payload)
                        ));
                    }
                    dispatched = true;
                }
                None => break,
            }
        }

        if dispatched {
            self.wake_js.notify();
        }

        dispatched
    }
}
