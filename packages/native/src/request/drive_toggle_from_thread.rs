#![cfg_attr(coverage_nightly, coverage(off))]

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::NativeHandle;
use crate::messaging::Mailbox;

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn drive_toggle_from_thread(
    env: Env,
    handle: &External<NativeHandle>,
    iterations: u32,
) -> napi::Result<()> {
    let addr = handle.ptr() as usize;
    let mailbox = Mailbox::global();
    for _ in 0..iterations {
        mailbox.schedule_glib(Box::new(move || {
            let object = addr as *mut glib::gobject_ffi::GObject;
            // SAFETY: this task runs on the gtkx-glib thread; `addr` is the handle's live GObject
            // pointer, kept alive by the caller for the duration of the iterations. The paired
            // ref/unref drives toggle-ref notifications while leaving the reference count unchanged.
            unsafe {
                glib::gobject_ffi::g_object_ref(object);
                glib::gobject_ffi::g_object_unref(object);
            }
        }));
    }
    mailbox.dispatch_and_wait_napi(env, || {})?;
    Ok(())
}
