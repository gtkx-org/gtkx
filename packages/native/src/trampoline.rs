//! Callback trampolines for GTK signal handlers.
//!
//! This module provides the C-compatible trampoline functions that bridge
//! between GTK's callback signature requirements and GLib closures.
//!
//! ## Key Types
//!
//! - [`ClosureCallbackData`]: User data passed to trampolines, contains the GClosure
//! - [`ClosureCallbackData::release`]: Generic destroy notify callback for ClosureCallbackData
//!
//! ## Trampoline Functions
//!
//! - [`ClosureCallbackData::draw_func`]: For `GtkDrawingArea` set_draw_func
//! - [`ClosureCallbackData::shortcut_func`]: For `GtkShortcutAction` callbacks
//! - [`ClosureCallbackData::tree_list_model_create_func`]: For `GtkTreeListModel` create_func
//! - [`ClosureCallbackData::animation_target_func`]: For `AdwCallbackAnimationTarget`
//! - [`ClosureCallbackData::scale_format_value_func`]: For `GtkScale` set_format_value_func
//! - [`ClosureCallbackData::tick_callback`]: For `GtkWidget` add_tick_callback
//! - [`destroy_trampoline`]: Generic destroy notify callback
//! - [`async_ready_trampoline`]: For `GAsyncReadyCallback`

use std::ffi::c_void;
use std::ptr::NonNull;

use gtk4::{
    cairo,
    gio::ffi::GAsyncResult,
    glib::{
        self, gobject_ffi,
        prelude::StaticType as _,
        translate::{FromGlibPtrNone as _, ToGlibPtr as _, ToGlibPtrMut as _},
        value::ToValue as _,
    },
};

pub struct ClosureGuard {
    closure: NonNull<gobject_ffi::GClosure>,
}

impl ClosureGuard {
    pub fn new(closure: NonNull<gobject_ffi::GClosure>) -> Self {
        unsafe { gobject_ffi::g_closure_ref(closure.as_ptr()) };
        Self { closure }
    }

    pub fn from_ptr(closure: *mut gobject_ffi::GClosure) -> Option<Self> {
        NonNull::new(closure).map(Self::new)
    }
}

impl Drop for ClosureGuard {
    fn drop(&mut self) {
        unsafe { gobject_ffi::g_closure_unref(self.closure.as_ptr()) };
    }
}

#[derive(Debug)]
pub struct ClosureCallbackData {
    closure: NonNull<gobject_ffi::GClosure>,
}

impl ClosureCallbackData {
    pub fn new(closure: NonNull<gobject_ffi::GClosure>) -> Self {
        Self { closure }
    }

    /// # Safety
    ///
    /// `user_data` must be a valid pointer to a `ClosureCallbackData` that was previously
    /// allocated via `Box::new`, or null. The `ClosureCallbackData` and its closure will be freed.
    pub unsafe extern "C" fn release(user_data: *mut c_void) {
        let Some(data_ptr) = NonNull::new(user_data as *mut ClosureCallbackData) else {
            return;
        };

        let data = unsafe { Box::from_raw(data_ptr.as_ptr()) };
        unsafe { gobject_ffi::g_closure_unref(data.closure.as_ptr()) };
    }

    /// # Safety
    ///
    /// - `drawing_area` must be a valid `GtkDrawingArea` pointer.
    /// - `cr` must be a valid `cairo_t` pointer.
    /// - `user_data` must be a valid pointer to a `ClosureCallbackData`, or null.
    pub unsafe extern "C" fn draw_func(
        drawing_area: *mut c_void,
        cr: *mut c_void,
        width: i32,
        height: i32,
        user_data: *mut c_void,
    ) {
        let Some(data_ptr) = NonNull::new(user_data as *mut ClosureCallbackData) else {
            eprintln!(
                "[gtkx] WARNING: ClosureCallbackData::draw_func: user_data is null, callback skipped"
            );
            return;
        };

        let data = unsafe { data_ptr.as_ref() };

        unsafe {
            let mut args: [glib::Value; 4] = [
                glib::Value::from_type_unchecked(glib::types::Type::OBJECT),
                glib::Value::from_type_unchecked(cairo::Context::static_type()),
                glib::Value::from_type_unchecked(glib::types::Type::I32),
                glib::Value::from_type_unchecked(glib::types::Type::I32),
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

    /// # Safety
    ///
    /// - `widget` must be a valid `GtkWidget` pointer.
    /// - `args` must be a valid `GVariant` pointer or null.
    /// - `user_data` must be a valid pointer to a `ClosureCallbackData`, or null.
    pub unsafe extern "C" fn shortcut_func(
        widget: *mut gobject_ffi::GObject,
        args: *mut glib::ffi::GVariant,
        user_data: *mut c_void,
    ) -> glib::ffi::gboolean {
        let Some(data_ptr) = NonNull::new(user_data as *mut ClosureCallbackData) else {
            eprintln!(
                "[gtkx] WARNING: ClosureCallbackData::shortcut_func: user_data is null, callback skipped"
            );
            return glib::ffi::GFALSE;
        };

        let data = unsafe { data_ptr.as_ref() };

        unsafe {
            let mut param_values: [glib::Value; 2] = [
                glib::Value::from_type_unchecked(glib::types::Type::OBJECT),
                glib::Value::from_type_unchecked(glib::types::Type::VARIANT),
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

    /// # Safety
    ///
    /// - `item` must be a valid `GObject` pointer.
    /// - `user_data` must be a valid pointer to a `ClosureCallbackData`, or null.
    pub unsafe extern "C" fn tree_list_model_create_func(
        item: *mut gobject_ffi::GObject,
        user_data: *mut c_void,
    ) -> *mut gobject_ffi::GObject {
        let Some(data_ptr) = NonNull::new(user_data as *mut ClosureCallbackData) else {
            eprintln!(
                "[gtkx] WARNING: ClosureCallbackData::tree_list_model_create_func: user_data is null, callback skipped"
            );
            return std::ptr::null_mut();
        };

        let data = unsafe { data_ptr.as_ref() };

        unsafe {
            let mut param_value = glib::Value::from_type_unchecked(glib::types::Type::OBJECT);
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

    /// Trampoline for `AdwAnimationTargetFunc`.
    ///
    /// # Safety
    ///
    /// - `value` is the animation value (0.0 to 1.0 typically).
    /// - `user_data` must be a valid pointer to a `ClosureCallbackData`, or null.
    pub unsafe extern "C" fn animation_target_func(value: f64, user_data: *mut c_void) {
        let Some(data_ptr) = NonNull::new(user_data as *mut ClosureCallbackData) else {
            eprintln!(
                "[gtkx] WARNING: ClosureCallbackData::animation_target_func: user_data is null, callback skipped"
            );
            return;
        };

        let data = unsafe { data_ptr.as_ref() };

        unsafe {
            let mut param_value = glib::Value::from_type_unchecked(glib::types::Type::F64);
            gobject_ffi::g_value_set_double(param_value.to_glib_none_mut().0, value);

            gobject_ffi::g_closure_invoke(
                data.closure.as_ptr(),
                std::ptr::null_mut(),
                1,
                param_value.to_glib_none_mut().0,
                std::ptr::null_mut(),
            );
        }
    }

    /// Trampoline for `GtkScaleFormatValueFunc`.
    ///
    /// # Safety
    ///
    /// - `scale` must be a valid `GtkScale` pointer.
    /// - `value` is the scale value to format.
    /// - `user_data` must be a valid pointer to a `ClosureCallbackData`, or null.
    pub unsafe extern "C" fn scale_format_value_func(
        scale: *mut gobject_ffi::GObject,
        value: f64,
        user_data: *mut c_void,
    ) -> *mut std::ffi::c_char {
        let Some(data_ptr) = NonNull::new(user_data as *mut ClosureCallbackData) else {
            eprintln!(
                "[gtkx] WARNING: ClosureCallbackData::scale_format_value_func: user_data is null, callback skipped"
            );
            return std::ptr::null_mut();
        };

        let data = unsafe { data_ptr.as_ref() };

        unsafe {
            let mut param_values: [glib::Value; 2] = [
                glib::Value::from_type_unchecked(glib::types::Type::OBJECT),
                glib::Value::from_type_unchecked(glib::types::Type::F64),
            ];

            gobject_ffi::g_value_set_object(param_values[0].to_glib_none_mut().0, scale);
            gobject_ffi::g_value_set_double(param_values[1].to_glib_none_mut().0, value);

            let mut return_value = glib::Value::from_type_unchecked(glib::types::Type::STRING);

            gobject_ffi::g_closure_invoke(
                data.closure.as_ptr(),
                return_value.to_glib_none_mut().0,
                2,
                param_values[0].to_glib_none_mut().0,
                std::ptr::null_mut(),
            );

            gobject_ffi::g_value_dup_string(return_value.to_glib_none().0)
        }
    }

    /// Trampoline for `GtkTickCallback`.
    ///
    /// # Safety
    ///
    /// - `widget` must be a valid `GtkWidget` pointer.
    /// - `frame_clock` must be a valid `GdkFrameClock` pointer.
    /// - `user_data` must be a valid pointer to a `ClosureCallbackData`, or null.
    pub unsafe extern "C" fn tick_callback(
        widget: *mut gobject_ffi::GObject,
        frame_clock: *mut gobject_ffi::GObject,
        user_data: *mut c_void,
    ) -> glib::ffi::gboolean {
        let Some(data_ptr) = NonNull::new(user_data as *mut ClosureCallbackData) else {
            eprintln!(
                "[gtkx] WARNING: ClosureCallbackData::tick_callback: user_data is null, callback skipped"
            );
            return glib::ffi::GFALSE;
        };

        let data = unsafe { data_ptr.as_ref() };

        unsafe {
            let mut param_values: [glib::Value; 2] = [
                glib::Value::from_type_unchecked(glib::types::Type::OBJECT),
                glib::Value::from_type_unchecked(glib::types::Type::OBJECT),
            ];

            gobject_ffi::g_value_set_object(param_values[0].to_glib_none_mut().0, widget);
            gobject_ffi::g_value_set_object(param_values[1].to_glib_none_mut().0, frame_clock);

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
}

/// # Safety
///
/// `user_data` must be a valid pointer to a `GClosure` that was previously
/// allocated and ref'd, or null. The closure will be invoked and then unref'd.
pub unsafe extern "C" fn destroy_trampoline(user_data: *mut c_void) {
    let Some(closure_ptr) = NonNull::new(user_data as *mut gobject_ffi::GClosure) else {
        eprintln!("[gtkx] WARNING: destroy_trampoline: user_data is null, callback skipped");
        return;
    };

    unsafe {
        let _guard = ClosureGuard::new(closure_ptr);

        gobject_ffi::g_closure_invoke(
            closure_ptr.as_ptr(),
            std::ptr::null_mut(),
            0,
            std::ptr::null(),
            std::ptr::null_mut(),
        );
    }

    unsafe { gobject_ffi::g_closure_unref(closure_ptr.as_ptr()) };
}

/// # Safety
///
/// - `source_object` must be a valid `GObject` pointer or null.
/// - `res` must be a valid `GAsyncResult` pointer or null.
/// - `user_data` must be a valid pointer to a `GClosure` that was previously
///   allocated and ref'd, or null. The closure will be invoked and then unref'd.
pub unsafe extern "C" fn async_ready_trampoline(
    source_object: *mut gobject_ffi::GObject,
    res: *mut GAsyncResult,
    user_data: *mut c_void,
) {
    let Some(closure_ptr) = NonNull::new(user_data as *mut gobject_ffi::GClosure) else {
        eprintln!("[gtkx] WARNING: async_ready_trampoline: user_data is null, callback skipped");
        return;
    };

    unsafe {
        let _guard = ClosureGuard::new(closure_ptr);

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
    }

    unsafe { gobject_ffi::g_closure_unref(closure_ptr.as_ptr()) };
}

pub struct TickCallbackData {
    pub channel: neon::event::Channel,
    pub js_func: std::sync::Arc<neon::handle::Root<neon::types::JsFunction>>,
    pub arg_types: Vec<crate::types::Type>,
}

pub struct PathIntersectionCallbackData {
    pub channel: neon::event::Channel,
    pub js_func: std::sync::Arc<neon::handle::Root<neon::types::JsFunction>>,
    pub arg_types: Vec<crate::types::Type>,
}

pub struct ShapeRendererCallbackData {
    pub channel: neon::event::Channel,
    pub js_func: std::sync::Arc<neon::handle::Root<neon::types::JsFunction>>,
    pub arg_types: Vec<crate::types::Type>,
}

impl TickCallbackData {
    /// # Safety
    ///
    /// `user_data` must be a valid pointer to a `TickCallbackData` that was
    /// previously allocated with `Box::into_raw`, or null.
    pub unsafe extern "C" fn release(user_data: *mut c_void) {
        let Some(data_ptr) = NonNull::new(user_data as *mut TickCallbackData) else {
            return;
        };
        let _ = unsafe { Box::from_raw(data_ptr.as_ptr()) };
    }

    /// # Safety
    ///
    /// - `widget` must be a valid pointer to a GObject (the widget).
    /// - `frame_clock` must be a valid pointer to a GdkFrameClock.
    /// - `user_data` must be a valid pointer to a `TickCallbackData` that was
    ///   previously allocated with `Box::into_raw`, or null.
    pub unsafe extern "C" fn tick_callback(
        widget: *mut gobject_ffi::GObject,
        frame_clock: *mut gobject_ffi::GObject,
        user_data: *mut c_void,
    ) -> glib::ffi::gboolean {
        let Some(data_ptr) = NonNull::new(user_data as *mut TickCallbackData) else {
            eprintln!(
                "[gtkx] WARNING: TickCallbackData::tick_callback: user_data is null, callback skipped"
            );
            return glib::ffi::GFALSE;
        };

        let data = unsafe { data_ptr.as_ref() };
        let channel = data.channel.clone();
        let js_func = data.js_func.clone();

        let widget_obj = unsafe { glib::Object::from_glib_none(widget) };
        let frame_clock_obj = unsafe { glib::Object::from_glib_none(frame_clock) };

        let widget_value =
            crate::value::Value::Object(crate::managed::NativeValue::GObject(widget_obj).into());
        let frame_clock_value = crate::value::Value::Object(
            crate::managed::NativeValue::GObject(frame_clock_obj).into(),
        );

        let args = vec![widget_value, frame_clock_value];

        let result = crate::js_dispatch::JsDispatcher::global().invoke_and_wait(
            &channel,
            &js_func,
            args,
            true,
            |result| match result {
                Ok(crate::value::Value::Boolean(b)) => b,
                _ => false,
            },
        );

        result as glib::ffi::gboolean
    }
}

impl PathIntersectionCallbackData {
    /// # Safety
    ///
    /// `user_data` must be a valid pointer to a `PathIntersectionCallbackData` that was
    /// previously allocated with `Box::into_raw`, or null.
    pub unsafe extern "C" fn release(user_data: *mut c_void) {
        let Some(data_ptr) = NonNull::new(user_data as *mut PathIntersectionCallbackData) else {
            return;
        };
        let _ = unsafe { Box::from_raw(data_ptr.as_ptr()) };
    }

    /// Trampoline for `GskPathIntersectionFunc`.
    ///
    /// # Safety
    ///
    /// - `path1` must be a valid pointer to a GskPath.
    /// - `point1` must be a valid pointer to a GskPathPoint.
    /// - `path2` must be a valid pointer to a GskPath.
    /// - `point2` must be a valid pointer to a GskPathPoint.
    /// - `kind` is the GskPathIntersection enum value.
    /// - `user_data` must be a valid pointer to a `PathIntersectionCallbackData` that was
    ///   previously allocated with `Box::into_raw`, or null.
    pub unsafe extern "C" fn path_intersection_func(
        path1: *mut gobject_ffi::GObject,
        point1: *const c_void,
        path2: *mut gobject_ffi::GObject,
        point2: *const c_void,
        kind: i32,
        user_data: *mut c_void,
    ) -> glib::ffi::gboolean {
        let Some(data_ptr) = NonNull::new(user_data as *mut PathIntersectionCallbackData) else {
            eprintln!(
                "[gtkx] WARNING: PathIntersectionCallbackData::path_intersection_func: user_data is null, callback skipped"
            );
            return glib::ffi::GFALSE;
        };

        let data = unsafe { data_ptr.as_ref() };
        let channel = data.channel.clone();
        let js_func = data.js_func.clone();

        let path1_obj = unsafe { glib::Object::from_glib_none(path1) };
        let path2_obj = unsafe { glib::Object::from_glib_none(path2) };

        let path1_value =
            crate::value::Value::Object(crate::managed::NativeValue::GObject(path1_obj).into());

        let point1_boxed = crate::managed::Boxed::borrowed(None, point1 as *mut c_void);
        let point1_value =
            crate::value::Value::Object(crate::managed::NativeValue::Boxed(point1_boxed).into());

        let path2_value =
            crate::value::Value::Object(crate::managed::NativeValue::GObject(path2_obj).into());

        let point2_boxed = crate::managed::Boxed::borrowed(None, point2 as *mut c_void);
        let point2_value =
            crate::value::Value::Object(crate::managed::NativeValue::Boxed(point2_boxed).into());

        let kind_value = crate::value::Value::Number(kind as f64);

        let args = vec![
            path1_value,
            point1_value,
            path2_value,
            point2_value,
            kind_value,
        ];

        let result = crate::js_dispatch::JsDispatcher::global().invoke_and_wait(
            &channel,
            &js_func,
            args,
            true,
            |result| match result {
                Ok(crate::value::Value::Boolean(b)) => b,
                _ => true,
            },
        );

        result as glib::ffi::gboolean
    }
}

impl ShapeRendererCallbackData {
    /// # Safety
    ///
    /// `user_data` must be a valid pointer to a `ShapeRendererCallbackData` that was
    /// previously allocated with `Box::into_raw`, or null.
    pub unsafe extern "C" fn release(user_data: *mut c_void) {
        let Some(data_ptr) = NonNull::new(user_data as *mut ShapeRendererCallbackData) else {
            return;
        };
        let _ = unsafe { Box::from_raw(data_ptr.as_ptr()) };
    }

    /// Trampoline for `PangoCairoShapeRendererFunc`.
    ///
    /// # Safety
    ///
    /// - `cr` must be a valid pointer to a cairo_t.
    /// - `attr` must be a valid pointer to a PangoAttrShape.
    /// - `do_path` is a gboolean indicating whether to only append the path.
    /// - `user_data` must be a valid pointer to a `ShapeRendererCallbackData` that was
    ///   previously allocated with `Box::into_raw`, or null.
    pub unsafe extern "C" fn shape_renderer_func(
        cr: *mut c_void,
        attr: *const c_void,
        do_path: glib::ffi::gboolean,
        user_data: *mut c_void,
    ) {
        let Some(data_ptr) = NonNull::new(user_data as *mut ShapeRendererCallbackData) else {
            eprintln!(
                "[gtkx] WARNING: ShapeRendererCallbackData::shape_renderer_func: user_data is null, callback skipped"
            );
            return;
        };

        let data = unsafe { data_ptr.as_ref() };
        let channel = data.channel.clone();
        let js_func = data.js_func.clone();

        let cr_value = crate::value::Value::Object(
            crate::managed::NativeValue::Boxed(crate::managed::Boxed::borrowed(
                Some(cairo::Context::static_type()),
                cr,
            ))
            .into(),
        );

        let attr_boxed = crate::managed::Boxed::borrowed(None, attr as *mut c_void);
        let attr_value =
            crate::value::Value::Object(crate::managed::NativeValue::Boxed(attr_boxed).into());

        let do_path_value = crate::value::Value::Boolean(do_path != glib::ffi::GFALSE);

        let args = vec![cr_value, attr_value, do_path_value];

        crate::js_dispatch::JsDispatcher::global().invoke_and_wait(
            &channel,
            &js_func,
            args,
            false,
            |_| (),
        );
    }
}
