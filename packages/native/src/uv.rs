use std::ffi::c_int;
use std::sync::mpsc::{Receiver, TryRecvError};

use neon::prelude::*;
use neon::sys::bindings as napi;

#[repr(C)]
pub struct UvLoop {
    _opaque: [u8; 0],
}

#[repr(C)]
#[allow(dead_code)]
pub enum UvRunMode {
    Default = 0,
    Once = 1,
    NoWait = 2,
}

unsafe extern "C" {
    fn napi_get_uv_event_loop(env: napi::Env, loop_: *mut *mut UvLoop) -> napi::Status;
    fn uv_run(loop_: *mut UvLoop, mode: UvRunMode) -> c_int;
}

pub fn get_event_loop<'a, C: Context<'a>>(cx: &C) -> *mut UvLoop {
    let env = cx.to_raw();
    let mut uv_loop: *mut UvLoop = std::ptr::null_mut();
    let status = unsafe { napi_get_uv_event_loop(env, &mut uv_loop) };

    assert_eq!(
        status,
        napi::Status::Ok,
        "Failed to get uv event loop (N-API status: {:?}) - this indicates a Node.js runtime error",
        status
    );

    uv_loop
}

pub fn run_nowait(uv_loop: *mut UvLoop) {
    unsafe {
        uv_run(uv_loop, UvRunMode::NoWait);
    }
}

pub fn wait_for_result<T>(uv_loop: *mut UvLoop, rx: &Receiver<T>, error_message: &str) -> T {
    loop {
        match rx.try_recv() {
            Ok(result) => return result,
            Err(TryRecvError::Empty) => {
                run_nowait(uv_loop);
            }
            Err(TryRecvError::Disconnected) => {
                panic!("Channel disconnected: {}", error_message);
            }
        }
    }
}
