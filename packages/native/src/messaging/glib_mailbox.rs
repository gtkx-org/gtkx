use std::panic::{self, AssertUnwindSafe};
use std::sync::atomic::Ordering;
use std::sync::{Mutex, OnceLock, mpsc};
use std::thread::JoinHandle;

use super::error_reporter::ErrorReporter;
use super::log_handler::GlibLogHandler;
use super::panic_handler::format_panic_payload;
use super::{GlibTask, LockExt as _, Mailbox, send_or_report};

#[derive(Debug, Default)]
pub struct GlibThread {
    handle: Mutex<Option<JoinHandle<()>>>,
    main_loop: Mutex<Option<glib::MainLoop>>,
}

static GLIB_THREAD: OnceLock<GlibThread> = OnceLock::new();

impl GlibThread {
    pub fn global() -> &'static Self {
        GLIB_THREAD.get_or_init(Self::default)
    }

    pub fn set_handle(&self, handle: JoinHandle<()>) {
        let previous = self.handle.lock_unpoison().replace(handle);
        if previous.is_some() {
            ErrorReporter::global()
                .report_str("GLib thread handle replaced while a previous thread was unjoined");
        }
    }

    pub fn join(&self) -> Option<String> {
        let handle = self.handle.lock_unpoison().take();

        if let Some(handle) = handle
            && let Err(payload) = handle.join()
        {
            return Some(format_panic_payload(&*payload));
        }
        None
    }

    pub fn take_main_loop(&self) -> Option<glib::MainLoop> {
        self.main_loop.lock_unpoison().take()
    }

    pub fn spawn(&self) -> napi::Result<()> {
        let (tx, rx) = mpsc::channel::<()>();

        let main_loop = glib::MainLoop::new(None, false);
        let main_loop_for_thread = main_loop.clone();
        *self.main_loop.lock_unpoison() = Some(main_loop);

        let handle = std::thread::Builder::new()
            .name("gtkx-glib".to_owned())
            .spawn(move || {
                GlibLogHandler::install();

                glib::idle_add_once(move || {
                    send_or_report(
                        &tx,
                        (),
                        "GLib main loop ready but startup channel was closed",
                    );
                });

                main_loop_for_thread.run();
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
        })?;
        Ok(())
    }
}

impl Mailbox {
    fn push_glib_task(&self, task: GlibTask) {
        let depth = self.callback_depth.load(Ordering::Acquire);
        self.glib_inbox.lock_unpoison().push_back((depth, task));
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
            Self::global().process_glib_pending();
            glib::ControlFlow::Break
        });
    }

    pub fn process_glib_pending(&self) -> bool {
        self.process_glib_pending_from_depth(0)
    }

    pub fn process_glib_pending_from_depth(&self, min_depth: usize) -> bool {
        let mut dispatched = false;

        loop {
            let task = {
                let mut inbox = self.glib_inbox.lock_unpoison();
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
            self.wake_node.notify();
        }

        dispatched
    }
}
