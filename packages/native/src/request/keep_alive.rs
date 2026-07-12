use napi_derive::napi;

use crate::runloop;

/// Enables or disables keeping the Node event loop alive while the GLib run loop is otherwise idle.
#[napi(catch_unwind)]
pub fn keep_alive(enable: bool) {
    runloop::set_keep_alive(enable);
}
