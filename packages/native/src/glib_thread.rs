use std::sync::OnceLock;
use std::thread::JoinHandle;

use parking_lot::Mutex;

use crate::error_reporter::NativeErrorReporter;
use crate::panic_handler::format_panic_payload;

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
            NativeErrorReporter::global()
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
}
