use std::cell::{Cell, RefCell};
use std::ffi::{CStr, c_char, c_void};
use std::rc::Rc;

use gtk4::glib;
use napi::bindgen_prelude::External;
use napi::{Env, JsValue as _, sys};
use native::ffi::closure::ClosureState;
use native::ffi::codec::{
    BoxedCodec, Codec, FloatCodec, FundamentalCodec, IntegerCodec, Ownership, RefCodec,
    StringCodec, StructCodec, VoidCodec,
};
use native::ffi::{
    ListData, ListNode, ListOps, ListPayload, ReleaseKind, Stash, StashData, StashStorage,
};
use native::handle::Handle;
use native::value::ClosureHandle;
use test_support as helpers;
use test_support::napi_mock;

fn js_fn_handle(env: &Env, value: sys::napi_value) -> ClosureHandle {
    ClosureHandle::from_js_value(env, &napi_mock::to_unknown(env, value))
        .expect("creating a ClosureHandle for the callback should succeed")
}

fn borrowed_string_codec() -> Codec {
    Codec::String(StringCodec {
        ownership: Ownership::Borrowed,
        length: None,
    })
}

fn recording_function(
    seen: &Rc<RefCell<Vec<Vec<sys::napi_value>>>>,
    return_value: impl Fn() -> sys::napi_value + 'static,
) -> sys::napi_value {
    let seen = Rc::clone(seen);
    napi_mock::fake_function(move |args| {
        seen.borrow_mut().push(args.to_vec());
        return_value()
    })
}

fn counting_function(
    respond: impl Fn(u32, &[sys::napi_value]) -> sys::napi_value + 'static,
) -> (sys::napi_value, Rc<Cell<u32>>) {
    let calls = Rc::new(Cell::new(0u32));
    let counter = Rc::clone(&calls);
    let js_fn = napi_mock::fake_function(move |args| {
        counter.set(counter.get() + 1);
        respond(counter.get(), args)
    });
    (js_fn, calls)
}

type StringReturn = unsafe extern "C" fn() -> *const c_char;

fn string_return_closure(env: &Env, js_fn: sys::napi_value) -> (Box<ClosureState>, StringReturn) {
    let state = ClosureState::boxed(
        js_fn_handle(env, js_fn),
        Vec::new(),
        borrowed_string_codec(),
        None,
        false,
    );
    let call: StringReturn = unsafe { std::mem::transmute(state.code_ptr) };
    (state, call)
}

type I32Return = unsafe extern "C" fn(i32) -> i32;

fn i32_return_closure(env: &Env, js_fn: sys::napi_value) -> (Box<ClosureState>, I32Return) {
    let state = ClosureState::boxed(
        js_fn_handle(env, js_fn),
        vec![Codec::Integer(IntegerCodec::I32)],
        Codec::Integer(IntegerCodec::I32),
        None,
        false,
    );
    let call: I32Return = unsafe { std::mem::transmute(state.code_ptr) };
    (state, call)
}

fn drain_default_context() {
    let context = glib::MainContext::default();
    while context.iteration(false) {}
}

#[allow(clippy::unnecessary_box_returns)]
fn void_closure(env: &Env, js_fn: sys::napi_value, oneshot: bool) -> Box<ClosureState> {
    ClosureState::boxed(
        js_fn_handle(env, js_fn),
        Vec::new(),
        Codec::Void(VoidCodec),
        None,
        oneshot,
    )
}

fn single_fatal_message() -> String {
    let fatals = napi_mock::fatal_exceptions();
    assert_eq!(fatals.len(), 1);
    napi_mock::read_object_property(fatals[0], "message")
        .and_then(napi_mock::read_string)
        .expect("the fatal exception should carry a message")
}

fn passthrough_prepend(list: *mut c_void, _data: *mut c_void) -> *mut c_void {
    list
}

fn end_node(_node: *mut c_void) -> ListNode {
    ListNode {
        data: std::ptr::null_mut(),
        next: std::ptr::null_mut(),
    }
}

fn panicking_free(_list: *mut c_void) {
    panic!("closure drop exploded");
}

static PANICKING_LIST_OPS: ListOps = ListOps {
    label: "panicking list",
    pending: ReleaseKind::GFree,
    prepend: passthrough_prepend,
    node: end_node,
    free: panicking_free,
    free_full: panicking_free,
};

fn stash_that_panics_on_drop() -> Stash {
    Stash::Storage(StashStorage::new(
        std::ptr::null_mut(),
        StashData::List(ListData {
            ops: &PANICKING_LIST_OPS,
            ptr: std::ptr::dangling_mut(),
            should_free: true,
            payload: ListPayload::Handles(Vec::new()),
        }),
    ))
}

#[test]
fn invocation_marshals_arguments_and_writes_the_return() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let seen = Rc::new(RefCell::new(Vec::new()));
        let js_fn = recording_function(&seen, || napi_mock::fake_double(42.0));
        let state = ClosureState::boxed(
            js_fn_handle(&env, js_fn),
            vec![
                Codec::Integer(IntegerCodec::I32),
                Codec::Float(FloatCodec::F64),
                borrowed_string_codec(),
            ],
            Codec::Integer(IntegerCodec::I32),
            None,
            false,
        );
        let call: unsafe extern "C" fn(i32, f64, *const c_char) -> i32 =
            unsafe { std::mem::transmute(state.code_ptr) };

        let returned = unsafe { call(-7, 2.5, c"marshal me".as_ptr()) };

        assert_eq!(returned, 42);
        let invocations = seen.borrow();
        assert_eq!(invocations.len(), 1);
        let args = &invocations[0];
        assert_eq!(args.len(), 3);
        assert_eq!(
            napi_mock::value_type(args[0]),
            Some(sys::ValueType::napi_number)
        );
        assert_eq!(napi_mock::read_double(args[0]), Some(-7.0));
        assert_eq!(napi_mock::read_double(args[1]), Some(2.5));
        assert_eq!(
            napi_mock::value_type(args[2]),
            Some(sys::ValueType::napi_string)
        );
        assert_eq!(
            napi_mock::read_string(args[2]).as_deref(),
            Some("marshal me")
        );
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

#[test]
fn the_user_data_argument_is_not_passed_to_js() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let seen = Rc::new(RefCell::new(Vec::new()));
        let js_fn = recording_function(&seen, napi_mock::fake_undefined);
        let state = ClosureState::boxed(
            js_fn_handle(&env, js_fn),
            vec![
                Codec::Integer(IntegerCodec::I32),
                Codec::Integer(IntegerCodec::I64),
            ],
            Codec::Void(VoidCodec),
            Some(1),
            false,
        );
        let call: unsafe extern "C" fn(i32, i64) = unsafe { std::mem::transmute(state.code_ptr) };

        unsafe { call(5, 0x1dead) };

        let invocations = seen.borrow();
        assert_eq!(invocations.len(), 1);
        assert_eq!(invocations[0].len(), 1);
        assert_eq!(napi_mock::read_double(invocations[0][0]), Some(5.0));
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

#[allow(clippy::unnecessary_box_returns)]
fn ref_i32_closure(env: &Env, js_fn: sys::napi_value, inout: bool) -> Box<ClosureState> {
    let ref_codec = RefCodec::new(Codec::Integer(IntegerCodec::I32), inout)
        .expect("Integer is a valid Ref inner");
    ClosureState::boxed(
        js_fn_handle(env, js_fn),
        vec![Codec::Ref(ref_codec)],
        Codec::Void(VoidCodec),
        None,
        false,
    )
}

fn seed_recording_function(seeded: &Rc<RefCell<Vec<sys::napi_value>>>) -> sys::napi_value {
    let seeded_in_fn = Rc::clone(seeded);
    napi_mock::fake_function(move |args| {
        let seed = napi_mock::read_object_property(args[0], "value")
            .expect("the ref object should carry a seeded value");
        seeded_in_fn.borrow_mut().push(seed);
        napi_mock::set_object_property(args[0], "value", napi_mock::fake_double(52.0));
        napi_mock::fake_undefined()
    })
}

fn assert_i32_ref_seed(inout: bool) {
    helpers::run(|| {
        let env = helpers::fake_env();
        let seeded = Rc::new(RefCell::new(Vec::new()));
        let js_fn = seed_recording_function(&seeded);
        let state = ref_i32_closure(&env, js_fn, inout);
        let call: unsafe extern "C" fn(*mut i32) = unsafe { std::mem::transmute(state.code_ptr) };

        let mut backing: i32 = 41;
        unsafe { call(&raw mut backing) };

        let seeds = seeded.borrow();
        assert_eq!(seeds.len(), 1);
        assert_eq!(napi_mock::read_double(seeds[0]), Some(41.0));
        assert_eq!(backing, 52);
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

#[test]
fn ref_inout_parameters_are_seeded_and_flushed() {
    assert_i32_ref_seed(true);
}

#[test]
fn ref_pure_out_scalar_parameters_are_not_seeded_from_the_slot() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let seeded = Rc::new(RefCell::new(Vec::new()));
        let js_fn = seed_recording_function(&seeded);
        let state = ref_i32_closure(&env, js_fn, false);
        let call: unsafe extern "C" fn(*mut i32) = unsafe { std::mem::transmute(state.code_ptr) };

        let mut backing: i32 = 41;
        unsafe { call(&raw mut backing) };

        let seeds = seeded.borrow();
        assert_eq!(seeds.len(), 1);
        assert_eq!(napi_mock::read_double(seeds[0]), None);
        assert_eq!(backing, 52);
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

fn string_seed_recording_function(seeded: &Rc<RefCell<Vec<sys::napi_value>>>) -> sys::napi_value {
    let seeded_in_fn = Rc::clone(seeded);
    napi_mock::fake_function(move |args| {
        let seed = napi_mock::read_object_property(args[0], "value")
            .expect("the ref object should carry a seeded value");
        seeded_in_fn.borrow_mut().push(seed);
        napi_mock::set_object_property(args[0], "value", napi_mock::fake_string("written"));
        napi_mock::fake_undefined()
    })
}

#[test]
fn ref_pure_out_pointer_parameters_are_seeded_null_without_reading_the_slot() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let seeded = Rc::new(RefCell::new(Vec::new()));
        let js_fn = string_seed_recording_function(&seeded);
        let ref_codec =
            RefCodec::new(borrowed_string_codec(), false).expect("String is a valid Ref inner");
        let state = ClosureState::boxed(
            js_fn_handle(&env, js_fn),
            vec![Codec::Ref(ref_codec)],
            Codec::Void(VoidCodec),
            None,
            false,
        );
        let call: unsafe extern "C" fn(*mut *const c_char) =
            unsafe { std::mem::transmute(state.code_ptr) };

        let mut backing: *const c_char = c"unread".as_ptr();
        unsafe { call(&raw mut backing) };

        let seeds = seeded.borrow();
        assert_eq!(seeds.len(), 1);
        assert!(napi_mock::is_null(seeds[0]));
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

#[test]
fn a_borrowed_string_return_stays_valid_after_the_call() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (js_fn, _) = counting_function(|count, _| {
            if count == 1 {
                napi_mock::fake_string("hello")
            } else {
                napi_mock::fake_string("world")
            }
        });
        let (state, call) = string_return_closure(&env, js_fn);

        let first = unsafe { call() };
        assert!(!first.is_null());
        assert_eq!(unsafe { CStr::from_ptr(first) }.to_str(), Ok("hello"));
        assert_eq!(
            state.data_ref().retained_string("hello").cast_const(),
            first
        );

        let second = unsafe { call() };
        assert!(!second.is_null());
        assert_eq!(unsafe { CStr::from_ptr(second) }.to_str(), Ok("world"));
        assert_eq!(
            state.data_ref().retained_string("world").cast_const(),
            second
        );
        assert_ne!(first, second);
        assert_eq!(unsafe { CStr::from_ptr(first) }.to_str(), Ok("hello"));
        assert!(napi_mock::fatal_exceptions().is_empty());

        drop(state);
    });
}

#[test]
fn a_repeated_borrowed_string_return_reuses_one_allocation() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (js_fn, _) = counting_function(|_, _| napi_mock::fake_string("stable"));
        let (state, call) = string_return_closure(&env, js_fn);

        let first = unsafe { call() };
        let second = unsafe { call() };
        assert_eq!(first, second);
        assert_eq!(unsafe { CStr::from_ptr(first) }.to_str(), Ok("stable"));
        assert!(napi_mock::fatal_exceptions().is_empty());

        drop(state);
    });
}

#[test]
fn a_borrowed_container_return_stays_valid_after_the_call() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (js_fn, _) = counting_function(|count, _| {
            let base = if count == 1 { 1.0 } else { 4.0 };
            napi_mock::fake_array(&[
                napi_mock::fake_double(base),
                napi_mock::fake_double(base + 1.0),
                napi_mock::fake_double(base + 2.0),
            ])
        });
        let state = ClosureState::boxed(
            js_fn_handle(&env, js_fn),
            Vec::new(),
            Codec::Array(helpers::i32_array_codec(3)),
            None,
            false,
        );
        let call: unsafe extern "C" fn() -> *const i32 =
            unsafe { std::mem::transmute(state.code_ptr) };

        let first = unsafe { call() };
        assert!(!first.is_null());
        assert_eq!(unsafe { std::slice::from_raw_parts(first, 3) }, [1, 2, 3]);

        let second = unsafe { call() };
        assert!(!second.is_null());
        assert_eq!(unsafe { std::slice::from_raw_parts(second, 3) }, [4, 5, 6]);
        assert_ne!(first, second);
        assert_eq!(unsafe { std::slice::from_raw_parts(first, 3) }, [1, 2, 3]);
        assert!(napi_mock::fatal_exceptions().is_empty());

        drop(state);
    });
}

#[test]
fn a_oneshot_closure_releases_its_resources_once_via_the_idle() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (js_fn, calls) = counting_function(|_, _| napi_mock::fake_undefined());
        let state = void_closure(&env, js_fn, true);
        let call: unsafe extern "C" fn() = unsafe { std::mem::transmute(state.code_ptr) };
        let callback_value =
            native::ffi::CallbackValue::new_pending_transfer(state.code_ptr, true, None, state);
        callback_value.disarm_pending_transfer();
        drop(callback_value);

        let deletions_before = napi_mock::count("napi_delete_reference");
        unsafe { call() };
        unsafe { call() };
        assert_eq!(calls.get(), 2);
        assert_eq!(napi_mock::count("napi_delete_reference"), deletions_before);

        helpers::pump_default_context_until(|| {
            napi_mock::count("napi_delete_reference") > deletions_before
        });
        assert_eq!(
            napi_mock::count("napi_delete_reference"),
            deletions_before + 1
        );

        drain_default_context();
        assert_eq!(
            napi_mock::count("napi_delete_reference"),
            deletions_before + 1
        );
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

#[test]
fn a_panicking_drop_in_the_destroy_notify_is_reported_and_contained() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (js_fn, _) = counting_function(|_, _| napi_mock::fake_undefined());
        let state = void_closure(&env, js_fn, false);
        state
            .data_ref()
            .retain_container(stash_that_panics_on_drop());
        let deletions_before = napi_mock::count("napi_delete_reference");

        unsafe { ClosureState::destroy(Box::into_raw(state).cast()) };

        let message = single_fatal_message();
        assert!(message.contains("panic at callback destroy notify"));
        assert!(message.contains("closure drop exploded"));
        assert_eq!(
            napi_mock::count("napi_delete_reference"),
            deletions_before + 1
        );

        let (follow_up_fn, calls) = counting_function(|_, _| napi_mock::fake_double(7.0));
        let (_state, call) = i32_return_closure(&env, follow_up_fn);
        assert_eq!(unsafe { call(3) }, 7);
        assert_eq!(calls.get(), 1);
    });
}

#[test]
fn the_closure_notify_destroy_releases_the_callback_reference() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (js_fn, _) = counting_function(|_, _| napi_mock::fake_undefined());
        let state = void_closure(&env, js_fn, false);
        let deletions_before = napi_mock::count("napi_delete_reference");

        unsafe {
            ClosureState::destroy_as_closure_notify(
                Box::into_raw(state).cast(),
                std::ptr::null_mut(),
            );
        }

        assert_eq!(
            napi_mock::count("napi_delete_reference"),
            deletions_before + 1
        );
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

#[test]
fn a_closure_notify_destroy_that_lands_mid_invocation_is_deferred_until_it_returns() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let state_ptr = Rc::new(Cell::new(std::ptr::null_mut::<c_void>()));
        let deletions_during = Rc::new(Cell::new(0usize));
        let destroyed_from = Rc::clone(&state_ptr);
        let counted_during = Rc::clone(&deletions_during);
        let js_fn = napi_mock::fake_function(move |_| {
            unsafe {
                ClosureState::destroy_as_closure_notify(
                    destroyed_from.get(),
                    std::ptr::dangling_mut(),
                );
            }
            counted_during.set(napi_mock::count("napi_delete_reference"));
            napi_mock::fake_undefined()
        });
        let state = void_closure(&env, js_fn, false);
        let call: unsafe extern "C" fn() = unsafe { std::mem::transmute(state.code_ptr) };
        let callback_value =
            native::ffi::CallbackValue::new_pending_transfer(state.code_ptr, true, None, state);
        state_ptr.set(callback_value.state_ptr());
        callback_value.disarm_pending_transfer();
        drop(callback_value);

        let deletions_before = napi_mock::count("napi_delete_reference");
        unsafe { call() };
        assert_eq!(deletions_during.get(), deletions_before);
        assert_eq!(napi_mock::count("napi_delete_reference"), deletions_before);

        helpers::pump_default_context_until(|| {
            napi_mock::count("napi_delete_reference") > deletions_before
        });
        assert_eq!(
            napi_mock::count("napi_delete_reference"),
            deletions_before + 1
        );

        drain_default_context();
        assert_eq!(
            napi_mock::count("napi_delete_reference"),
            deletions_before + 1
        );
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

fn assert_transfer_full_return_yields_null_and_reports(return_codec: Codec, expected: &str) {
    let env = helpers::fake_env();
    let backing = unsafe { glib::ffi::g_malloc0(16) };
    let js_fn = napi_mock::fake_function(move |_| {
        let env = helpers::fake_env();
        External::new(Handle::from_glib_borrow(backing))
            .into_unknown(&env)
            .expect("external into unknown should succeed")
            .raw()
    });
    let state = ClosureState::boxed(
        js_fn_handle(&env, js_fn),
        Vec::new(),
        return_codec,
        None,
        false,
    );
    let call: unsafe extern "C" fn() -> *mut c_void =
        unsafe { std::mem::transmute(state.code_ptr) };

    let returned = unsafe { call() };

    assert!(
        returned.is_null(),
        "the C caller must not receive a pointer whose ownership never transferred"
    );
    assert!(single_fatal_message().contains(expected));
    assert!(napi_mock::pending_exception().is_none());

    unsafe { glib::ffi::g_free(backing) };
}

#[test]
fn a_transfer_full_boxed_return_with_an_unresolvable_type_yields_null_and_reports() {
    helpers::run(|| {
        assert_transfer_full_return_yields_null_and_reports(
            Codec::Boxed(BoxedCodec {
                ownership: Ownership::Full,
                type_name: "GtkxUnknownBoxedType".to_owned(),
                shared_library: None,
                get_type_fn_name: None,
                free_fn_name: None,
                caller_allocated: false,
                size: None,
                inline: false,
            }),
            "GtkxUnknownBoxedType",
        );
    });
}

#[test]
fn a_transfer_full_fundamental_return_with_unresolvable_fns_yields_null_and_reports() {
    helpers::run(|| {
        assert_transfer_full_return_yields_null_and_reports(
            Codec::Fundamental(FundamentalCodec {
                ownership: Ownership::Full,
                shared_library: "libgobject-2.0.so.0".to_owned(),
                ref_fn_name: "gtkx_missing_fundamental_ref".to_owned(),
                unref_fn_name: "gtkx_missing_fundamental_unref".to_owned(),
                inline: false,
            }),
            "gtkx_missing_fundamental_ref",
        );
    });
}

#[test]
fn a_transfer_full_struct_return_with_an_unknown_size_yields_null_and_reports() {
    helpers::run(|| {
        assert_transfer_full_return_yields_null_and_reports(
            Codec::Struct(StructCodec {
                ownership: Ownership::Full,
                size: None,
                caller_allocated: false,
                inline: false,
            }),
            "its size is unknown",
        );
    });
}

#[test]
fn a_thrown_callback_writes_the_err_return_and_throws_into_node() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let exception = napi_mock::fake_error("callback exploded");
        let js_fn = napi_mock::fake_throwing_function(exception);
        let (_state, call) = i32_return_closure(&env, js_fn);

        let returned = unsafe { call(11) };

        assert_eq!(returned, 0);
        assert_eq!(napi_mock::pending_exception(), Some(exception));
        assert_eq!(napi_mock::thrown_exceptions(), vec![exception]);
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

#[test]
fn the_closure_stays_usable_after_a_throw() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let exception = napi_mock::fake_error("first call exploded");
        let (js_fn, calls) = counting_function(move |count, args| {
            if count == 1 {
                napi_mock::set_pending_exception(exception);
                napi_mock::fake_undefined()
            } else {
                let doubled =
                    napi_mock::read_double(args[0]).expect("the argument should be a number") * 2.0;
                napi_mock::fake_double(doubled)
            }
        });
        let (_state, call) = i32_return_closure(&env, js_fn);

        assert_eq!(unsafe { call(11) }, 0);
        assert_eq!(napi_mock::take_pending_exception(), Some(exception));

        assert_eq!(unsafe { call(21) }, 42);
        assert_eq!(calls.get(), 2);
        assert!(napi_mock::pending_exception().is_none());
        assert_eq!(napi_mock::thrown_exceptions(), vec![exception]);
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

#[test]
fn a_throw_returns_null_without_disturbing_earlier_borrowed_string_returns() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let exception = napi_mock::fake_error("second call exploded");
        let (js_fn, _) = counting_function(move |count, _| {
            if count == 1 {
                napi_mock::fake_string("alpha")
            } else {
                napi_mock::set_pending_exception(exception);
                napi_mock::fake_undefined()
            }
        });
        let (state, call) = string_return_closure(&env, js_fn);

        let first = unsafe { call() };
        assert_eq!(unsafe { CStr::from_ptr(first) }.to_str(), Ok("alpha"));
        assert!(!state.data_ref().retained_string("alpha").is_null());

        let second = unsafe { call() };
        assert!(second.is_null());
        assert_eq!(unsafe { CStr::from_ptr(first) }.to_str(), Ok("alpha"));
        assert_eq!(napi_mock::take_pending_exception(), Some(exception));
        assert_eq!(napi_mock::thrown_exceptions(), vec![exception]);
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}
