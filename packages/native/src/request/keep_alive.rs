use napi_derive::napi;

use crate::runloop;

#[napi(catch_unwind)]
pub fn keep_alive(enable: bool) {
    runloop::set_keep_alive(enable);
}
