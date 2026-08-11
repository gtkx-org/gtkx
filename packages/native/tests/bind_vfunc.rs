use std::ffi::c_void;
use std::mem::offset_of;

use gtk4::gio;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::glib::{self};
use gtk4::prelude::{ActionMapExt as _, ObjectType as _, StaticType as _};
use helpers::napi_mock;
use napi::bindgen_prelude::{Array, BigInt, External, FromNapiValue as _};
use napi::{Env, JsValue as _};
use native::api::bind::{BindVfuncOptions, bind_vfunc};
use native::api::call::call;
use native::ffi::codec::Ownership;
use native::ffi::descriptor::Descriptor;
use native::handle::Handle;
use test_support as helpers;

fn gtype(type_: glib::Type) -> BigInt {
    BigInt::from(type_.into_glib() as u64)
}

fn offset(value: usize) -> u32 {
    u32::try_from(value).expect("a vtable offset fits in a u32")
}

fn borrowed_object() -> Descriptor {
    Descriptor::Object {
        ownership: Ownership::Borrowed,
        is_call_scoped: None,
    }
}

fn borrowed_string() -> Descriptor {
    Descriptor::String {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn object_value(env: &Env, ptr: *mut c_void) -> napi::sys::napi_value {
    External::new(Handle::from_glib_borrow(ptr))
        .into_unknown(env)
        .expect("wrapping the handle should succeed")
        .raw()
}

fn values<'e>(env: &'e Env, items: &[napi::sys::napi_value]) -> Array<'e> {
    Array::from_unknown(napi_mock::to_unknown(env, napi_mock::fake_array(items)))
        .expect("a fake array should convert to an Array")
}

fn menu_is_mutable_options(instance_type: glib::Type) -> BindVfuncOptions {
    BindVfuncOptions {
        instance_type: Some(gtype(instance_type)),
        interface_type: None,
        byte_offset: offset(offset_of!(gio::ffi::GMenuModelClass, is_mutable)),
        vtable_size: None,
        label: "MenuModelClass.is_mutable".to_owned(),
        arg_descriptors: vec![borrowed_object()],
        return_descriptor: Descriptor::Boolean,
    }
}

#[test]
fn calls_a_class_vtable_slot_of_the_named_type() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind_vfunc(menu_is_mutable_options(gio::Menu::static_type()))
            .expect("binding an inherited class slot should succeed");
        let menu = gio::Menu::new();

        let result = call(
            &env,
            &descriptor,
            values(&env, &[object_value(&env, menu.as_ptr().cast::<c_void>())]),
        )
        .expect("calling the parent implementation should succeed");

        assert_eq!(napi_mock::read_bool(result.raw()), Some(true));
    });
}

#[test]
fn resolves_the_slot_from_the_named_type_not_the_instance() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind_vfunc(menu_is_mutable_options(gio::MenuModel::static_type()))
            .expect("binding the abstract type's slot should succeed");
        let menu = gio::Menu::new();

        let Err(error) = call(
            &env,
            &descriptor,
            values(&env, &[object_value(&env, menu.as_ptr().cast::<c_void>())]),
        ) else {
            panic!("the empty slot of the named type must not fall through to the instance");
        };

        let message = error.to_string();
        assert!(
            message.contains("MenuModelClass.is_mutable"),
            "unexpected error: {message}"
        );
        assert!(
            message.contains("provides no implementation"),
            "unexpected error: {message}"
        );
    });
}

#[test]
fn reports_a_null_class_slot() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind_vfunc(BindVfuncOptions {
            instance_type: Some(gtype(gio::Application::static_type())),
            interface_type: None,
            byte_offset: offset(offset_of!(gio::ffi::GApplicationClass, run_mainloop)),
            vtable_size: None,
            label: "ApplicationClass.run_mainloop".to_owned(),
            arg_descriptors: vec![borrowed_object()],
            return_descriptor: Descriptor::Void,
        })
        .expect("binding an empty slot should succeed");
        let application = gio::Application::new(None, gio::ApplicationFlags::empty());

        let Err(error) = call(
            &env,
            &descriptor,
            values(
                &env,
                &[object_value(&env, application.as_ptr().cast::<c_void>())],
            ),
        ) else {
            panic!("an empty slot must be reported rather than called");
        };

        let message = error.to_string();
        assert!(
            message.contains("ApplicationClass.run_mainloop"),
            "unexpected error: {message}"
        );
        assert!(
            message.contains("provides no implementation"),
            "unexpected error: {message}"
        );
    });
}

#[test]
fn calls_an_interface_slot_through_the_parent_class() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind_vfunc(BindVfuncOptions {
            instance_type: Some(gtype(gio::SimpleActionGroup::static_type())),
            interface_type: Some(gtype(gio::ActionGroup::static_type())),
            byte_offset: offset(offset_of!(gio::ffi::GActionGroupInterface, has_action)),
            vtable_size: Some(offset(size_of::<gio::ffi::GActionGroupInterface>())),
            label: "ActionGroupInterface.has_action".to_owned(),
            arg_descriptors: vec![borrowed_object(), borrowed_string()],
            return_descriptor: Descriptor::Boolean,
        })
        .expect("binding an interface slot should succeed");
        let group = gio::SimpleActionGroup::new();
        group.add_action(&gio::SimpleAction::new("frob", None));

        let result = call(
            &env,
            &descriptor,
            values(
                &env,
                &[
                    object_value(&env, group.as_ptr().cast::<c_void>()),
                    napi_mock::fake_string("frob"),
                ],
            ),
        )
        .expect("calling the interface implementation should succeed");

        assert_eq!(napi_mock::read_bool(result.raw()), Some(true));
    });
}

#[test]
fn reports_a_type_that_does_not_carry_the_interface() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind_vfunc(BindVfuncOptions {
            instance_type: Some(gtype(glib::Object::static_type())),
            interface_type: Some(gtype(gio::ActionGroup::static_type())),
            byte_offset: offset(offset_of!(gio::ffi::GActionGroupInterface, has_action)),
            vtable_size: Some(offset(size_of::<gio::ffi::GActionGroupInterface>())),
            label: "ActionGroupInterface.has_action".to_owned(),
            arg_descriptors: vec![borrowed_object(), borrowed_string()],
            return_descriptor: Descriptor::Boolean,
        })
        .expect("binding does not check interface conformance");
        let object = glib::Object::new::<glib::Object>();

        let Err(error) = call(
            &env,
            &descriptor,
            values(
                &env,
                &[
                    object_value(&env, object.as_ptr().cast::<c_void>()),
                    napi_mock::fake_string("frob"),
                ],
            ),
        ) else {
            panic!("a type without the interface must be reported");
        };

        let message = error.to_string();
        assert!(
            message.contains("does not implement interface"),
            "unexpected error: {message}"
        );
    });
}

fn default_has_action_options() -> BindVfuncOptions {
    BindVfuncOptions {
        instance_type: None,
        interface_type: Some(gtype(gio::ActionGroup::static_type())),
        byte_offset: offset(offset_of!(gio::ffi::GActionGroupInterface, has_action)),
        vtable_size: Some(offset(size_of::<gio::ffi::GActionGroupInterface>())),
        label: "ActionGroupInterface.has_action".to_owned(),
        arg_descriptors: vec![borrowed_object(), borrowed_string()],
        return_descriptor: Descriptor::Boolean,
    }
}

#[test]
fn calls_the_implementation_an_interface_installs_by_default() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind_vfunc(default_has_action_options())
            .expect("binding a slot of the default vtable should succeed");
        let group = gio::SimpleActionGroup::new();
        group.add_action(&gio::SimpleAction::new("frob", None));

        let result = call(
            &env,
            &descriptor,
            values(
                &env,
                &[
                    object_value(&env, group.as_ptr().cast::<c_void>()),
                    napi_mock::fake_string("frob"),
                ],
            ),
        )
        .expect("calling the default implementation should succeed");

        assert_eq!(napi_mock::read_bool(result.raw()), Some(true));
    });
}

#[test]
fn reports_the_interface_when_its_default_vtable_leaves_the_slot_empty() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind_vfunc(BindVfuncOptions {
            instance_type: None,
            interface_type: Some(gtype(gio::ListModel::static_type())),
            byte_offset: offset(offset_of!(gio::ffi::GListModelInterface, get_n_items)),
            vtable_size: Some(offset(size_of::<gio::ffi::GListModelInterface>())),
            label: "ListModelInterface.get_n_items".to_owned(),
            arg_descriptors: vec![borrowed_object()],
            return_descriptor: Descriptor::Uint32,
        })
        .expect("binding an empty default slot should succeed");
        let store = gio::ListStore::new::<glib::Object>();

        let Err(error) = call(
            &env,
            &descriptor,
            values(&env, &[object_value(&env, store.as_ptr().cast::<c_void>())]),
        ) else {
            panic!("an empty default slot must be reported rather than called");
        };

        let message = error.to_string();
        assert!(
            message.contains("interface 'GListModel'"),
            "unexpected error: {message}"
        );
        assert!(
            message.contains("provides no implementation"),
            "unexpected error: {message}"
        );
    });
}

#[test]
fn rejects_a_slot_named_by_neither_an_instance_type_nor_an_interface_type() {
    helpers::run(|| {
        let mut options = default_has_action_options();
        options.interface_type = None;

        let Err(error) = bind_vfunc(options) else {
            panic!("a slot with no vtable to read it from must be rejected");
        };

        assert!(
            error
                .to_string()
                .contains("neither an instance type nor an interface type"),
            "unexpected error: {error}"
        );
    });
}

#[test]
fn rejects_a_default_interface_slot_without_a_vtable_size() {
    helpers::run(|| {
        let mut options = default_has_action_options();
        options.vtable_size = None;

        let Err(error) = bind_vfunc(options) else {
            panic!("a default interface slot with no vtable size must be rejected");
        };

        assert!(
            error.to_string().contains("without a vtable size"),
            "unexpected error: {error}"
        );
    });
}

#[test]
fn rejects_an_unaligned_class_offset() {
    helpers::run(|| {
        let mut options = menu_is_mutable_options(gio::Menu::static_type());
        options.byte_offset = 4;

        assert!(bind_vfunc(options).is_err());
    });
}

#[test]
fn rejects_a_class_offset_past_the_queried_class_size() {
    helpers::run(|| {
        let mut options = menu_is_mutable_options(gio::Menu::static_type());
        options.byte_offset = offset(size_of::<gio::ffi::GMenuModelClass>() * 4);

        let Err(error) = bind_vfunc(options) else {
            panic!("an out-of-bounds offset must be rejected");
        };

        assert!(
            error.to_string().contains("exceeds class size"),
            "unexpected error: {error}"
        );
    });
}

#[test]
fn rejects_an_interface_offset_past_the_declared_vtable_size() {
    helpers::run(|| {
        let Err(error) = bind_vfunc(BindVfuncOptions {
            instance_type: Some(gtype(gio::SimpleActionGroup::static_type())),
            interface_type: Some(gtype(gio::ActionGroup::static_type())),
            byte_offset: offset(offset_of!(gio::ffi::GActionGroupInterface, has_action)),
            vtable_size: Some(16),
            label: "ActionGroupInterface.has_action".to_owned(),
            arg_descriptors: vec![borrowed_object(), borrowed_string()],
            return_descriptor: Descriptor::Boolean,
        }) else {
            panic!("an offset past the declared vtable must be rejected");
        };

        assert!(
            error.to_string().contains("exceeds class size 16"),
            "unexpected error: {error}"
        );
    });
}
