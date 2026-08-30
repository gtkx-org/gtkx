use std::panic::AssertUnwindSafe;

use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::StaticType as _;
use native::value::pending_wrapper;
use test_support as helpers;

fn object_gtype() -> glib::ffi::GType {
    glib::Object::static_type().into_glib()
}

fn binding_gtype() -> glib::ffi::GType {
    glib::Binding::static_type().into_glib()
}

#[test]
fn claim_finds_nothing_when_nothing_is_pending() {
    helpers::run(|| {
        let (object, object_ptr, _) = helpers::fresh_gobject();
        assert!(pending_wrapper::claim(object_ptr, object_gtype()).is_none());
        drop(object);
    });
}

#[test]
fn claim_takes_a_matching_entry_exactly_once() {
    helpers::run(|| {
        let (object, object_ptr, _) = helpers::fresh_gobject();
        let (wrapper, associate) = helpers::pending_values();
        let guard = unsafe { pending_wrapper::push(object_gtype(), wrapper, associate) };

        assert!(guard.claimed_instance().is_none());
        assert_eq!(
            pending_wrapper::claim(object_ptr, object_gtype()),
            Some((wrapper, associate))
        );
        assert_eq!(guard.claimed_instance(), Some(object_ptr));
        assert!(pending_wrapper::claim(object_ptr, object_gtype()).is_none());

        drop(guard);
        drop(object);
    });
}

#[test]
fn claim_ignores_an_entry_pushed_for_another_type() {
    helpers::run(|| {
        let (object, object_ptr, _) = helpers::fresh_gobject();
        let (wrapper, associate) = helpers::pending_values();
        let guard = unsafe { pending_wrapper::push(binding_gtype(), wrapper, associate) };

        assert!(pending_wrapper::claim(object_ptr, object_gtype()).is_none());
        assert!(guard.claimed_instance().is_none());

        drop(guard);
        drop(object);
    });
}

#[test]
fn claim_only_looks_at_the_innermost_entry() {
    helpers::run(|| {
        let (object, object_ptr, _) = helpers::fresh_gobject();
        let (outer_wrapper, outer_associate) = helpers::pending_values();
        let (inner_wrapper, inner_associate) = helpers::pending_values();
        let outer =
            unsafe { pending_wrapper::push(object_gtype(), outer_wrapper, outer_associate) };
        let inner =
            unsafe { pending_wrapper::push(binding_gtype(), inner_wrapper, inner_associate) };

        assert!(pending_wrapper::claim(object_ptr, object_gtype()).is_none());
        assert!(outer.claimed_instance().is_none());

        drop(inner);
        assert_eq!(
            pending_wrapper::claim(object_ptr, object_gtype()),
            Some((outer_wrapper, outer_associate))
        );
        assert_eq!(outer.claimed_instance(), Some(object_ptr));

        drop(outer);
        drop(object);
    });
}

#[test]
fn the_guard_removes_its_entry_when_its_scope_returns_early() {
    helpers::run(|| {
        let (object, object_ptr, _) = helpers::fresh_gobject();
        let (wrapper, associate) = helpers::pending_values();

        let bailed = || -> Option<()> {
            let _guard = unsafe { pending_wrapper::push(object_gtype(), wrapper, associate) };
            None?;
            Some(())
        };

        assert!(bailed().is_none());
        assert!(pending_wrapper::claim(object_ptr, object_gtype()).is_none());
        drop(object);
    });
}

#[test]
fn the_guard_removes_its_entry_when_its_scope_unwinds() {
    helpers::run(|| {
        let (object, object_ptr, _) = helpers::fresh_gobject();
        let (wrapper, associate) = helpers::pending_values();
        let previous = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));

        let unwound = std::panic::catch_unwind(AssertUnwindSafe(|| {
            let _guard = unsafe { pending_wrapper::push(object_gtype(), wrapper, associate) };
            panic!("boom");
        }));

        std::panic::set_hook(previous);
        assert!(unwound.is_err());
        assert!(pending_wrapper::claim(object_ptr, object_gtype()).is_none());
        drop(object);
    });
}
