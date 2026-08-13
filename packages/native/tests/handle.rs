use std::cell::Cell;
use std::ffi::c_void;
use std::rc::Rc;

use gtk4::glib;
use gtk4::glib::translate::from_glib_full;
use gtk4::prelude::ObjectType as _;
use helpers::{
    get_gobject_refcount, make_bool_param_spec as param_spec_ptr, param_spec_ref,
    param_spec_refcount, param_spec_unref, pump_default_context_until,
};
use native::handle::{BorrowScope, Fundamental, Handle};
use native::value::wrapper;
use test_support as helpers;
use test_support::napi_mock;

fn owned_fundamental(ptr: *mut c_void) -> Handle {
    Handle::from(unsafe { Fundamental::from_glib_full(ptr, Some(param_spec_unref)) })
}

fn borrowed_fundamental(ptr: *mut c_void) -> Handle {
    let fundamental =
        unsafe { Fundamental::from_glib_none(ptr, Some(param_spec_ref), Some(param_spec_unref)) };
    Handle::from(fundamental)
}

fn decoded_gobject_handle() -> Handle {
    let obj = glib::Object::new::<glib::Object>();
    Handle::decoded_gobject(obj)
}

fn extra_referenced_decoded_gobject() -> (glib::Object, *mut glib::gobject_ffi::GObject, u32, Handle)
{
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();
    unsafe { glib::gobject_ffi::g_object_ref(obj_ptr) };
    let initial_ref = unsafe { get_gobject_refcount(obj_ptr) };

    let owned: glib::Object = unsafe { from_glib_full(obj_ptr) };
    let handle = Handle::decoded_gobject(owned);
    (obj, obj_ptr, initial_ref, handle)
}

#[test]
fn boxed_handle_records_pointer() {
    helpers::run(|| {
        let (boxed, ptr) = helpers::owned_rgba_boxed();

        let handle = Handle::from(boxed);

        assert_eq!(handle.as_ptr(), ptr);
    });
}

#[test]
fn fundamental_handle_records_pointer() {
    let ptr = param_spec_ptr();

    let handle = owned_fundamental(ptr);

    assert_eq!(handle.as_ptr(), ptr);
}

#[test]
fn borrowed_handle_has_no_owned_value() {
    let raw = 0xABCD_1234usize as *mut c_void;
    let handle = Handle::from_glib_borrow(raw);

    assert_eq!(handle.as_ptr(), raw);
    assert_eq!(handle.ptr_as_usize(), raw as usize);

    let debug_str = format!("{handle:?}");
    assert!(debug_str.contains("Handle"));
    assert!(debug_str.contains("Borrowed"));

    let moved = handle;
    assert_eq!(moved.as_ptr(), raw);
}

#[test]
fn borrowed_handle_with_null_pointer() {
    let handle = Handle::from_glib_borrow(std::ptr::null_mut());

    assert!(handle.as_ptr().is_null());
    assert_eq!(handle.ptr_as_usize(), 0);
}

#[test]
fn drop_owned_handle_releases_value() {
    helpers::run(|| {
        let ptr = param_spec_ptr();
        let handle = borrowed_fundamental(ptr);
        let initial_ref = unsafe { param_spec_refcount(ptr) };

        drop(handle);
        assert_eq!(unsafe { param_spec_refcount(ptr) }, initial_ref - 1);

        unsafe { param_spec_unref(ptr) };
    });
}

#[test]
fn drop_borrowed_handle_is_noop() {
    let handle = Handle::from_glib_borrow(0x1111usize as *mut c_void);
    drop(handle);
}

#[test]
fn struct_handle_records_pointer_and_frees_on_drop() {
    helpers::run(|| {
        let ptr = unsafe { glib::ffi::g_malloc0(32) };
        let handle = Handle::owned_struct(ptr);

        assert_eq!(handle.as_ptr(), ptr);
        assert!(handle.size_hint() > 0);
        assert!(format!("{handle:?}").contains("Struct"));

        drop(handle);
    });
}

#[test]
fn drop_struct_handle_with_null_pointer_is_safe() {
    let handle = Handle::owned_struct(std::ptr::null_mut());

    assert!(handle.as_ptr().is_null());
    drop(handle);
}

#[test]
fn a_consumed_decoded_handle_drop_releases_nothing() {
    helpers::run(|| {
        let (_obj, obj_ptr, initial_ref, handle) = extra_referenced_decoded_gobject();
        let taken = handle.take_owned();
        assert!(taken.is_some());
        drop(handle);

        let sentinel = Rc::new(Cell::new(false));
        let sentinel_in_idle = Rc::clone(&sentinel);
        glib::idle_add_local_once(move || sentinel_in_idle.set(true));
        pump_default_context_until(|| sentinel.get());

        assert!(sentinel.get());
        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, initial_ref);

        drop(taken);
        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, initial_ref - 1);
    });
}

#[test]
fn a_decoded_handle_drop_releases_unconsumed_ref() {
    helpers::run(|| {
        let (_obj, obj_ptr, initial_ref, handle) = extra_referenced_decoded_gobject();
        drop(handle);

        pump_default_context_until(|| unsafe { get_gobject_refcount(obj_ptr) } == initial_ref - 1);

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, initial_ref - 1);
    });
}

#[test]
fn take_owned_consumes_the_object_once() {
    helpers::run(|| {
        let handle = decoded_gobject_handle();

        assert!(handle.take_owned().is_some());
        assert!(handle.take_owned().is_none());
    });
}

#[test]
fn release_owned_drops_the_reference_the_handle_holds() {
    helpers::run(|| {
        let (obj, obj_ptr, initial_ref, handle) = extra_referenced_decoded_gobject();

        handle.release_owned();

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, initial_ref - 1);

        drop(handle);
        drop(obj);
    });
}

#[test]
fn a_call_scoped_gobject_handle_owns_nothing_until_it_is_invalidated() {
    helpers::run(|| {
        let (obj, obj_ptr, before) = helpers::fresh_gobject();
        let handle = Handle::borrowed_gobject(obj_ptr);

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);
        assert_eq!(handle.as_gobject_ptr(), Some(obj_ptr));
        assert!(handle.take_owned().is_none());
        assert!(!handle.is_invalidated());

        handle.invalidate();

        assert!(handle.is_invalidated());
        assert!(handle.as_gobject_ptr().is_none());
        assert!(handle.as_ptr().is_null());
        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);

        drop(obj);
    });
}

#[test]
fn invalidating_a_borrowed_handle_ends_its_reference() {
    let raw = 0xABCD_1234usize as *mut c_void;
    let handle = Handle::from_glib_borrow(raw);

    assert!(!handle.is_invalidated());
    assert_eq!(handle.as_ptr(), raw);

    handle.invalidate();

    assert!(handle.is_invalidated());
    assert!(handle.as_ptr().is_null());
}

#[test]
fn a_borrow_scope_hands_back_only_the_borrows_taken_while_it_was_open() {
    helpers::run(|| {
        let before = Handle::from_glib_borrow(0x1000usize as *mut c_void);
        let scope = BorrowScope::open();
        let inside = Handle::from_glib_borrow(0x2000usize as *mut c_void);
        let (obj, obj_ptr, _) = helpers::fresh_gobject();
        let call_scoped = Handle::borrowed_gobject(obj_ptr);
        let collected = scope.close();
        let after = Handle::from_glib_borrow(0x3000usize as *mut c_void);

        assert_eq!(collected.len(), 2);

        for handle in &collected {
            handle.invalidate();
        }

        assert!(inside.is_invalidated());
        assert!(call_scoped.is_invalidated());
        assert!(!before.is_invalidated());
        assert!(!after.is_invalidated());

        drop(obj);
    });
}

#[test]
fn a_borrow_scope_that_is_never_closed_stops_collecting_when_it_is_dropped() {
    helpers::run(|| {
        drop(BorrowScope::open());

        let handle = Handle::from_glib_borrow(0x4000usize as *mut c_void);
        let collected = BorrowScope::open().close();

        assert!(collected.is_empty());
        assert!(!handle.is_invalidated());
    });
}

#[test]
fn take_owned_on_a_borrowed_handle_returns_none() {
    helpers::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle = Handle::from_glib_borrow(obj.as_ptr().cast::<c_void>());

        assert!(handle.take_owned().is_none());
    });
}

#[test]
fn a_field_of_a_borrowed_owner_stops_reaching_it_when_the_borrow_ends() {
    helpers::run(|| {
        let mut owner = [0u32; 4];
        let owner_ptr = owner.as_mut_ptr().cast::<c_void>();
        let owner_handle = Handle::from_glib_borrow(owner_ptr);
        let field = Handle::field(&owner_handle, size_of::<u32>() * 2);

        assert_eq!(field.as_ptr(), owner_ptr.wrapping_byte_add(8));
        assert_eq!(field.size_hint(), 0);
        assert!(!field.is_invalidated());

        owner_handle.invalidate();

        assert!(field.is_invalidated());
        assert!(field.as_ptr().is_null());
    });
}

#[test]
fn size_hint_distinguishes_handle_variants() {
    helpers::run(|| {
        let (boxed, _boxed_ptr) = helpers::owned_rgba_boxed();
        let boxed_hint = Handle::from(boxed).size_hint();

        let pspec = param_spec_ptr();
        let fundamental_hint =
            Handle::from(unsafe { Fundamental::from_glib_full(pspec, Some(param_spec_unref)) })
                .size_hint();

        assert!(boxed_hint > 0);
        assert!(fundamental_hint > 0);
        assert_ne!(boxed_hint, fundamental_hint);
    });
}

#[test]
fn borrowed_handle_reports_zero_size_hint() {
    let handle = Handle::from_glib_borrow(0xDEAD_BEEFusize as *mut c_void);
    assert_eq!(handle.size_hint(), 0);
}

#[test]
fn decoded_gobject_handle_reports_nonzero_size_hint() {
    helpers::run(|| {
        let handle = decoded_gobject_handle();
        assert!(handle.size_hint() > 0);
        assert!(handle.take_owned().is_some());
    });
}

struct WrappedGobject {
    ptr: usize,
    napi_ref: napi::sys::napi_ref,
    binding: Rc<wrapper::WrapperHandle>,
    generation: u64,
}

fn wrapped_gobject_owned_by_worker() -> WrappedGobject {
    let (obj, obj_ptr, _) = helpers::fresh_gobject();
    let napi_ref = napi_mock::fake_reference();
    let (binding, generation) = unsafe { wrapper::install(obj_ptr, napi_ref.cast()) };
    std::mem::forget(obj);
    WrappedGobject {
        ptr: obj_ptr as usize,
        napi_ref,
        binding,
        generation,
    }
}

fn release_wrapper(wrapped: WrappedGobject) {
    let napi_ref = wrapped.napi_ref;
    unsafe {
        wrapper::schedule_cleanup(
            Some(wrapped.binding),
            wrapped.generation,
            wrapped.ptr as *mut glib::gobject_ffi::GObject,
            napi_ref.cast(),
        );
    }
    pump_default_context_until(|| napi_mock::reference_is_deleted(napi_ref));
}

#[test]
fn main_thread_toggle_notifications_apply_synchronously() {
    helpers::run(|| {
        let (obj, obj_ptr, _) = helpers::fresh_gobject();
        let napi_ref = napi_mock::fake_reference();
        let (binding, generation) = unsafe { wrapper::install(obj_ptr, napi_ref.cast()) };

        let unref_baseline = napi_mock::count("napi_reference_unref");
        drop(obj);

        assert_eq!(napi_mock::count("napi_reference_unref"), unref_baseline + 1);
        assert_eq!(napi_mock::reference_count(napi_ref), Some(0));

        release_wrapper(WrappedGobject {
            ptr: obj_ptr as usize,
            napi_ref,
            binding,
            generation,
        });
    });
}

#[test]
fn off_thread_toggle_notifications_marshal_to_the_install_thread() {
    helpers::run(|| {
        let wrapped = wrapped_gobject_owned_by_worker();
        let (raw, napi_ref) = (wrapped.ptr, wrapped.napi_ref);

        let unref_baseline = napi_mock::count("napi_reference_unref");
        std::thread::spawn(move || unsafe {
            glib::gobject_ffi::g_object_unref(raw as *mut glib::gobject_ffi::GObject);
        })
        .join()
        .expect("the worker unref should not crash");

        assert_eq!(napi_mock::count("napi_reference_unref"), unref_baseline);
        assert_eq!(napi_mock::reference_count(napi_ref), Some(1));

        pump_default_context_until(|| napi_mock::count("napi_reference_unref") > unref_baseline);
        assert_eq!(napi_mock::count("napi_reference_unref"), unref_baseline + 1);
        assert_eq!(napi_mock::reference_count(napi_ref), Some(0));

        let ref_baseline = napi_mock::count("napi_reference_ref");
        std::thread::spawn(move || unsafe {
            glib::gobject_ffi::g_object_ref(raw as *mut glib::gobject_ffi::GObject);
        })
        .join()
        .expect("the worker ref should not crash");

        pump_default_context_until(|| napi_mock::count("napi_reference_ref") > ref_baseline);
        assert_eq!(napi_mock::count("napi_reference_ref"), ref_baseline + 1);
        assert_eq!(napi_mock::reference_count(napi_ref), Some(1));

        release_wrapper(wrapped);
        unsafe { glib::gobject_ffi::g_object_unref(raw as *mut glib::gobject_ffi::GObject) };
    });
}

#[test]
fn queued_toggle_resyncs_converge_to_the_final_reference_state() {
    helpers::run(|| {
        let wrapped = wrapped_gobject_owned_by_worker();
        let (raw, napi_ref) = (wrapped.ptr, wrapped.napi_ref);

        std::thread::spawn(move || unsafe {
            let gobject = raw as *mut glib::gobject_ffi::GObject;
            glib::gobject_ffi::g_object_unref(gobject);
            glib::gobject_ffi::g_object_ref(gobject);
            glib::gobject_ffi::g_object_unref(gobject);
        })
        .join()
        .expect("the worker toggles should not crash");

        pump_default_context_until(|| napi_mock::reference_count(napi_ref) == Some(0));
        pump_default_context_until(|| false);

        assert_eq!(napi_mock::reference_count(napi_ref), Some(0));
        assert_eq!(napi_mock::count("napi_reference_unref"), 1);
        assert_eq!(napi_mock::count("napi_reference_ref"), 0);

        release_wrapper(wrapped);
    });
}
