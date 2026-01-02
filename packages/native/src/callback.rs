use std::ffi::c_void;
use std::ptr::NonNull;

use gtk4::{
    gio::ffi::GAsyncResult,
    glib::{
        self, gobject_ffi,
        translate::{FromGlibPtrNone as _, ToGlibPtr as _, ToGlibPtrMut as _},
        value::ToValue as _,
    },
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CallbackKind {
    DrawFunc,
    ShortcutFunc,
    TreeListModelCreateFunc,
}

#[derive(Debug)]
pub struct CallbackData {
    pub closure: NonNull<gobject_ffi::GClosure>,
    pub arg_gtypes: Vec<glib::Type>,
    pub kind: CallbackKind,
}

impl CallbackData {
    pub fn new(
        closure: NonNull<gobject_ffi::GClosure>,
        arg_gtypes: Vec<glib::Type>,
        kind: CallbackKind,
    ) -> Self {
        Self {
            closure,
            arg_gtypes,
            kind,
        }
    }
}

unsafe extern "C" fn callback_data_destroy(user_data: *mut c_void) {
    let Some(data_ptr) = NonNull::new(user_data as *mut CallbackData) else {
        return;
    };

    let data = unsafe { Box::from_raw(data_ptr.as_ptr()) };
    unsafe { gobject_ffi::g_closure_unref(data.closure.as_ptr()) };
}

pub fn get_callback_data_destroy_ptr() -> *mut c_void {
    callback_data_destroy as *mut c_void
}

pub struct TrampolineSpec {
    pub trampoline_ptr: *mut c_void,
    pub destroy_ptr: *mut c_void,
    pub kind: CallbackKind,
}

impl TrampolineSpec {
    pub fn draw_func() -> Self {
        Self {
            trampoline_ptr: draw_func_trampoline as *mut c_void,
            destroy_ptr: callback_data_destroy as *mut c_void,
            kind: CallbackKind::DrawFunc,
        }
    }

    pub fn shortcut_func() -> Self {
        Self {
            trampoline_ptr: shortcut_func_trampoline as *mut c_void,
            destroy_ptr: callback_data_destroy as *mut c_void,
            kind: CallbackKind::ShortcutFunc,
        }
    }

    pub fn tree_list_model_create_func() -> Self {
        Self {
            trampoline_ptr: tree_list_model_create_func_trampoline as *mut c_void,
            destroy_ptr: callback_data_destroy as *mut c_void,
            kind: CallbackKind::TreeListModelCreateFunc,
        }
    }
}

fn marshal_gvalue_at_index(data: &CallbackData, index: usize, fallback: glib::Type) -> glib::Value {
    unsafe { glib::Value::from_type_unchecked(data.arg_gtypes.get(index).copied().unwrap_or(fallback)) }
}

unsafe extern "C" fn draw_func_trampoline(
    drawing_area: *mut c_void,
    cr: *mut c_void,
    width: i32,
    height: i32,
    user_data: *mut c_void,
) {
    let Some(data_ptr) = NonNull::new(user_data as *mut CallbackData) else {
        eprintln!("[gtkx] WARNING: draw_func_trampoline: user_data is null, callback skipped");
        return;
    };

    let data = unsafe { data_ptr.as_ref() };

    unsafe {
        let mut args: [glib::Value; 4] = [
            marshal_gvalue_at_index(data, 0, glib::types::Type::OBJECT),
            marshal_gvalue_at_index(data, 1, glib::types::Type::POINTER),
            marshal_gvalue_at_index(data, 2, glib::types::Type::I32),
            marshal_gvalue_at_index(data, 3, glib::types::Type::I32),
        ];

        gobject_ffi::g_value_set_object(
            args[0].to_glib_none_mut().0,
            drawing_area as *mut gobject_ffi::GObject,
        );

        gobject_ffi::g_value_set_boxed(args[1].to_glib_none_mut().0, cr);
        gobject_ffi::g_value_set_int(args[2].to_glib_none_mut().0, width);
        gobject_ffi::g_value_set_int(args[3].to_glib_none_mut().0, height);

        gobject_ffi::g_closure_invoke(
            data.closure.as_ptr(),
            std::ptr::null_mut(),
            4,
            args[0].to_glib_none_mut().0,
            std::ptr::null_mut(),
        );
    }
}

pub fn get_draw_func_trampoline_ptr() -> *mut c_void {
    draw_func_trampoline as *mut c_void
}

unsafe extern "C" fn destroy_trampoline(user_data: *mut c_void) {
    let Some(closure_ptr) = NonNull::new(user_data as *mut gobject_ffi::GClosure) else {
        eprintln!("[gtkx] WARNING: destroy_trampoline: user_data is null, callback skipped");
        return;
    };

    unsafe {
        gobject_ffi::g_closure_invoke(
            closure_ptr.as_ptr(),
            std::ptr::null_mut(),
            0,
            std::ptr::null(),
            std::ptr::null_mut(),
        );

        gobject_ffi::g_closure_unref(closure_ptr.as_ptr());
    }
}

pub fn get_destroy_trampoline_ptr() -> *mut c_void {
    destroy_trampoline as *mut c_void
}

unsafe extern "C" fn async_ready_trampoline(
    source_object: *mut gobject_ffi::GObject,
    res: *mut GAsyncResult,
    user_data: *mut c_void,
) {
    let Some(closure_ptr) = NonNull::new(user_data as *mut gobject_ffi::GClosure) else {
        eprintln!("[gtkx] WARNING: async_ready_trampoline: user_data is null, callback skipped");
        return;
    };

    unsafe {
        let source_obj: Option<glib::Object> =
            NonNull::new(source_object).map(|p| glib::Object::from_glib_none(p.as_ptr()));

        let res_obj: Option<glib::Object> = NonNull::new(res as *mut gobject_ffi::GObject)
            .map(|p| glib::Object::from_glib_none(p.as_ptr()));

        let source_value: glib::Value = source_obj.to_value();
        let res_value: glib::Value = res_obj.to_value();
        let param_values = [source_value, res_value];

        gobject_ffi::g_closure_invoke(
            closure_ptr.as_ptr(),
            std::ptr::null_mut(),
            param_values.len() as u32,
            param_values.as_ptr() as *const gobject_ffi::GValue as *const _,
            std::ptr::null_mut(),
        );

        gobject_ffi::g_closure_unref(closure_ptr.as_ptr());
    }
}

pub fn get_async_ready_trampoline_ptr() -> *mut c_void {
    async_ready_trampoline as *mut c_void
}

unsafe extern "C" fn shortcut_func_trampoline(
    widget: *mut gobject_ffi::GObject,
    args: *mut glib::ffi::GVariant,
    user_data: *mut c_void,
) -> glib::ffi::gboolean {
    let Some(data_ptr) = NonNull::new(user_data as *mut CallbackData) else {
        eprintln!("[gtkx] WARNING: shortcut_func_trampoline: user_data is null, callback skipped");
        return glib::ffi::GFALSE;
    };

    let data = unsafe { data_ptr.as_ref() };

    unsafe {
        let mut param_values: [glib::Value; 2] = [
            marshal_gvalue_at_index(data, 0, glib::types::Type::OBJECT),
            marshal_gvalue_at_index(data, 1, glib::types::Type::VARIANT),
        ];

        gobject_ffi::g_value_set_object(param_values[0].to_glib_none_mut().0, widget);

        gobject_ffi::g_value_set_variant(param_values[1].to_glib_none_mut().0, args as *mut _);

        let mut return_value = glib::Value::from_type_unchecked(glib::types::Type::BOOL);

        gobject_ffi::g_closure_invoke(
            data.closure.as_ptr(),
            return_value.to_glib_none_mut().0,
            2,
            param_values[0].to_glib_none_mut().0,
            std::ptr::null_mut(),
        );

        return_value.get::<bool>().unwrap_or(false) as glib::ffi::gboolean
    }
}

pub fn get_shortcut_func_trampoline_ptr() -> *mut c_void {
    shortcut_func_trampoline as *mut c_void
}

unsafe extern "C" fn tree_list_model_create_func_trampoline(
    item: *mut gobject_ffi::GObject,
    user_data: *mut c_void,
) -> *mut gobject_ffi::GObject {
    let Some(data_ptr) = NonNull::new(user_data as *mut CallbackData) else {
        eprintln!("[gtkx] WARNING: tree_list_model_create_func_trampoline: user_data is null, callback skipped");
        return std::ptr::null_mut();
    };

    let data = unsafe { data_ptr.as_ref() };

    unsafe {
        let mut param_value = marshal_gvalue_at_index(data, 0, glib::types::Type::OBJECT);

        gobject_ffi::g_value_set_object(param_value.to_glib_none_mut().0, item);

        let mut return_value = glib::Value::from_type_unchecked(glib::types::Type::OBJECT);

        gobject_ffi::g_closure_invoke(
            data.closure.as_ptr(),
            return_value.to_glib_none_mut().0,
            1,
            param_value.to_glib_none_mut().0,
            std::ptr::null_mut(),
        );

        let result_ptr = gobject_ffi::g_value_get_object(return_value.to_glib_none().0);
        if !result_ptr.is_null() {
            gobject_ffi::g_object_ref(result_ptr as *mut _);
        }
        result_ptr
    }
}

pub fn get_tree_list_model_create_func_trampoline_ptr() -> *mut c_void {
    tree_list_model_create_func_trampoline as *mut c_void
}
