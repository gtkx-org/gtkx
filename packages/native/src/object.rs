

use std::ffi::c_void;

use gtk4::glib::{self, object::ObjectType as _};
use neon::prelude::*;

use crate::{boxed::Boxed, gvariant::GVariant, gtk_dispatch, state::GtkThreadState};

#[derive(Debug)]
#[allow(clippy::enum_variant_names)]
pub enum Object {

    GObject(glib::Object),

    Boxed(Boxed),

    GVariant(GVariant),
}

impl Clone for Object {
    fn clone(&self) -> Self {
        match self {
            Object::GObject(obj) => Object::GObject(obj.clone()),
            Object::Boxed(boxed) => Object::Boxed(boxed.clone()),
            Object::GVariant(variant) => Object::GVariant(variant.clone()),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct ObjectId(pub usize);

impl ObjectId {

    pub fn new(object: Object) -> Self {
        GtkThreadState::with(|state| {
            let id = state.next_object_id;
            state.next_object_id += 1;
            state.object_map.insert(id, object);
            ObjectId(id)
        })
    }

    pub fn as_ptr(&self) -> Option<*mut c_void> {
        GtkThreadState::with(|state| {
            state.object_map.get(&self.0).map(|object| match object {
                Object::GObject(obj) => obj.as_ptr() as *mut c_void,
                Object::Boxed(boxed) => *boxed.as_ref(),
                Object::GVariant(variant) => variant.as_ptr(),
            })
        })
    }

    pub fn try_as_ptr(&self) -> Option<usize> {
        self.as_ptr().map(|ptr| ptr as usize)
    }
}

impl Finalize for ObjectId {
    fn finalize<'a, C: Context<'a>>(self, _cx: &mut C) {
        gtk_dispatch::schedule(move || {
            GtkThreadState::with(|state| {
                state.object_map.remove(&self.0);
            });
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils;
    use gtk4::gdk;
    use gtk4::prelude::StaticType as _;

    fn create_test_gobject() -> glib::Object {
        test_utils::ensure_gtk_init();
        glib::Object::new::<glib::Object>()
    }

    #[test]
    fn object_id_new_registers_in_map() {
        let obj = create_test_gobject();
        let object = Object::GObject(obj);
        let id = ObjectId::new(object);

        assert!(id.0 > 0);

        GtkThreadState::with(|state| {
            assert!(state.object_map.contains_key(&id.0));
        });
    }

    #[test]
    fn object_id_as_ptr_returns_correct_pointer() {
        let obj = create_test_gobject();
        let expected_ptr = obj.as_ptr() as *mut c_void;
        let object = Object::GObject(obj);
        let id = ObjectId::new(object);

        let ptr = id.as_ptr();
        assert_eq!(ptr, Some(expected_ptr));
    }

    #[test]
    fn object_id_as_ptr_returns_none_after_removal() {
        let obj = create_test_gobject();
        let object = Object::GObject(obj);
        let id = ObjectId::new(object);

        GtkThreadState::with(|state| {
            state.object_map.remove(&id.0);
        });

        assert_eq!(id.as_ptr(), None);
    }

    #[test]
    fn object_id_try_as_ptr_returns_usize() {
        let obj = create_test_gobject();
        let expected_ptr = obj.as_ptr() as usize;
        let object = Object::GObject(obj);
        let id = ObjectId::new(object);

        let ptr = id.try_as_ptr();
        assert_eq!(ptr, Some(expected_ptr));
    }

    #[test]
    fn object_id_increments_sequentially() {
        let obj1 = create_test_gobject();
        let obj2 = create_test_gobject();

        let id1 = ObjectId::new(Object::GObject(obj1));
        let id2 = ObjectId::new(Object::GObject(obj2));

        assert!(id2.0 > id1.0);
    }

    #[test]
    fn object_boxed_stores_and_retrieves() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let ptr = test_utils::allocate_test_boxed(gtype);
        let boxed = Boxed::from_glib_full(Some(gtype), ptr);
        let object = Object::Boxed(boxed);
        let id = ObjectId::new(object);

        let retrieved_ptr = id.as_ptr();
        assert_eq!(retrieved_ptr, Some(ptr));
    }

    #[test]
    fn object_gobject_clone_shares_reference() {
        let obj = create_test_gobject();
        let object = Object::GObject(obj.clone());
        let cloned = object.clone();

        let ptr1 = match &object {
            Object::GObject(o) => o.as_ptr(),
            _ => panic!("Expected GObject"),
        };

        let ptr2 = match &cloned {
            Object::GObject(o) => o.as_ptr(),
            _ => panic!("Expected GObject"),
        };

        assert_eq!(ptr1, ptr2);
    }

    #[test]
    fn object_boxed_clone_creates_copy() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let ptr = test_utils::allocate_test_boxed(gtype);
        let boxed = Boxed::from_glib_full(Some(gtype), ptr);
        let object = Object::Boxed(boxed);
        let cloned = object.clone();

        let ptr1 = match &object {
            Object::Boxed(b) => *b.as_ref(),
            _ => panic!("Expected Boxed"),
        };

        let ptr2 = match &cloned {
            Object::Boxed(b) => *b.as_ref(),
            _ => panic!("Expected Boxed"),
        };

        assert_ne!(ptr1, ptr2);
    }

    #[test]
    fn gobject_refcount_preserved_in_map() {
        let obj = create_test_gobject();
        let initial_ref = unsafe {
            let ptr = obj.as_ptr();
            (*ptr).ref_count
        };

        let _id = ObjectId::new(Object::GObject(obj.clone()));

        let after_ref = unsafe {
            let ptr = obj.as_ptr();
            (*ptr).ref_count
        };

        assert!(after_ref >= initial_ref);
    }

    #[test]
    fn multiple_objects_independent() {
        let obj1 = create_test_gobject();
        let obj2 = create_test_gobject();

        let id1 = ObjectId::new(Object::GObject(obj1.clone()));
        let id2 = ObjectId::new(Object::GObject(obj2.clone()));

        GtkThreadState::with(|state| {
            state.object_map.remove(&id1.0);
        });

        assert_eq!(id1.as_ptr(), None);
        assert!(id2.as_ptr().is_some());
    }
}
