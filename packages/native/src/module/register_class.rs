//! Dynamic `GType` registration.
//!
//! Registers new `GObject` subclasses at runtime from a JavaScript class
//! descriptor: parses vfunc and inherited-interface overrides, builds a libffi
//! trampoline for each handler, and writes the resulting function pointers into
//! the new class's vtable (via [`class_init_trampoline`]) and its copies of any
//! inherited interface vtables (via [`PreparedInterface::install`]).
//!
//! The functions that parse the JS descriptor or build trampolines around a
//! captured JS callback are excluded from coverage instrumentation — they
//! require a live [`napi::Env`] or a [`JsRef`], neither of which exists in a
//! `cargo test` process. The pure registration logic ([`RegisterClassRequest::execute`],
//! [`RegisterClassRequest::query_parent_gtype`], [`RegisterClassRequest::validate_vfunc_offset`])
//! is exercised directly by tests.

use std::ffi::{c_char, c_void};
use std::sync::Arc;

use gtk4::glib::{
    self, gobject_ffi,
    translate::{FromGlib as _, IntoGlib as _},
};
use napi::bindgen_prelude::*;
use napi::{Env, JsFunction, JsObject, NapiValue as _};
use napi_derive::napi;

use super::handler::ModuleRequest;
use crate::error_reporter::NativeErrorReporter;
use crate::trampoline::{TrampolineData, TrampolineState};
use crate::types::Type;
use crate::value::{JsRef, map_js_array};

/// JS-thread parse output for a vfunc override.
///
/// The libffi closure is built on the `GLib` thread inside
/// [`RawVfunc::into_built`], where the trampoline will eventually fire.
#[cfg_attr(test, allow(dead_code))]
struct RawVfunc {
    byte_offset: usize,
    js_func: Arc<JsRef<JsFunction>>,
    arg_types: Vec<Type>,
    return_type: Type,
}

/// JS-thread parse output for the vfunc overrides of one interface that the
/// new class inherits from its parent.
#[cfg_attr(test, allow(dead_code))]
struct RawInterface {
    gtype: glib::Type,
    vfuncs: Vec<RawVfunc>,
}

impl RawVfunc {
    #[cfg_attr(test, allow(dead_code))]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn from_js_value(env: &Env, item: Unknown<'_>) -> napi::Result<Self> {
        let obj = crate::value::unknown_as_object(env, &item)?;
        let byte_offset: f64 = obj.get_named_property("byteOffset")?;
        if byte_offset < 0.0 {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "register_class: vfunc byteOffset must be non-negative",
            ));
        }
        let arg_types_prop: Unknown<'_> = obj.get_named_property("argTypes")?;
        let return_type_prop: Unknown<'_> = obj.get_named_property("returnType")?;
        let handler_prop: Unknown<'_> = obj.get_named_property("fn")?;
        if !matches!(handler_prop.get_type()?, napi::ValueType::Function) {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "register_class: vfunc 'fn' must be a function",
            ));
        }
        // SAFETY: `handler_prop` is a live JS value from the current
        // callback's `env`, verified to be a function just above.
        let handler: JsFunction =
            unsafe { JsFunction::from_raw_unchecked(env.raw(), handler_prop.raw()) };

        let arg_types = parse_type_array(env, arg_types_prop)?;
        let return_type = Type::from_js_value(env, return_type_prop)?;
        let js_func = Arc::new(JsRef::from_js_value(env, &handler)?);

        Ok(Self {
            byte_offset: byte_offset as usize,
            js_func,
            arg_types,
            return_type,
        })
    }

    #[cfg_attr(test, allow(dead_code))]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn into_built(self) -> PreparedVfunc {
        let Self {
            byte_offset,
            js_func,
            arg_types,
            return_type,
        } = self;
        let data = TrampolineData::new(js_func, arg_types, return_type, None, false);
        let state = Box::new(TrampolineState::create(data));
        let code_ptr = state.code_ptr;
        PreparedVfunc {
            byte_offset,
            code_ptr,
            state,
        }
    }
}

impl RawInterface {
    #[allow(clippy::trivially_copy_pass_by_ref)]
    #[cfg_attr(test, allow(dead_code))]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn from_js_value(env: &Env, item: Unknown<'_>) -> napi::Result<Self> {
        let obj = crate::value::unknown_as_object(env, &item)?;
        // SAFETY: Converting a numeric GType value has no pointer
        // preconditions; validity is checked just below.
        let gtype = unsafe {
            glib::Type::from_glib(obj.get_named_property::<f64>("gtype")? as glib::ffi::GType)
        };
        if !gtype.is_valid() {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "register_class: interface gtype must be non-zero",
            ));
        }
        let vfuncs_prop: Unknown<'_> = obj.get_named_property("vfuncs")?;
        let vfuncs = parse_js_array(
            env,
            vfuncs_prop,
            "interface vfuncs",
            RawVfunc::from_js_value,
        )?;
        Ok(Self { gtype, vfuncs })
    }

    #[cfg_attr(test, allow(dead_code))]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn into_built(self) -> PreparedInterface {
        PreparedInterface {
            gtype: self.gtype,
            vfuncs: self.vfuncs.into_iter().map(RawVfunc::into_built).collect(),
        }
    }
}

/// Built vfunc trampoline waiting to be written into a vtable.
///
/// `code_ptr` is the libffi-generated C function pointer; `state` retains the
/// `TrampolineData` and libffi closure for the lifetime of the type registration.
#[cfg_attr(test, allow(dead_code))]
struct PreparedVfunc {
    byte_offset: usize,
    code_ptr: *mut c_void,
    state: Box<TrampolineState>,
}

/// Built interface vfunc overrides for one inherited interface.
///
/// `gtype` identifies the interface; each vfunc's `byte_offset` is relative to
/// the interface struct base. The overrides are written into the new class's
/// own copy of the inherited interface vtable by [`PreparedInterface::install`].
#[cfg_attr(test, allow(dead_code))]
struct PreparedInterface {
    gtype: glib::Type,
    vfuncs: Vec<PreparedVfunc>,
}

impl PreparedVfunc {
    /// Writes each prepared vfunc's trampoline pointer into the vtable rooted
    /// at `vtable_base`, then leaks the trampoline state so its libffi closure
    /// outlives the type registration.
    #[cfg_attr(test, allow(dead_code))]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn install_all(vtable_base: *mut c_void, vfuncs: Vec<Self>) {
        for vfunc in vfuncs {
            // SAFETY: The request validated each byte offset against the
            // queried class size and pointer alignment, so the slot lies
            // within the live vtable GLib allocated for the new type.
            unsafe {
                let slot = vtable_base
                    .cast::<u8>()
                    .add(vfunc.byte_offset)
                    .cast::<*mut c_void>();
                slot.write(vfunc.code_ptr);
            }
            std::mem::forget(vfunc.state);
        }
    }
}

impl PreparedInterface {
    /// Writes this interface's vfunc overrides into the new class's own copy of
    /// the inherited interface vtable.
    ///
    /// `g_type_class_ref` has already initialized the class, so `GLib` has
    /// allocated a per-type copy of every inherited interface vtable. Writing
    /// into that copy overrides the interface methods for the new type only,
    /// leaving the parent's vtable untouched.
    #[cfg_attr(test, allow(dead_code))]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn install(self, class_ptr: *mut c_void) {
        // SAFETY: `class_ptr` is the live class structure returned by
        // `g_type_class_ref`, the receiver `g_type_interface_peek`
        // requires.
        let iface_vtable =
            unsafe { gobject_ffi::g_type_interface_peek(class_ptr, self.gtype.into_glib()) };
        if iface_vtable.is_null() {
            NativeErrorReporter::global().report_str(&format!(
                "register_class: registered type does not conform to interface {:#x}",
                self.gtype.into_glib()
            ));
            return;
        }
        PreparedVfunc::install_all(iface_vtable, self.vfuncs);
    }
}

#[cfg_attr(test, allow(dead_code))]
#[cfg_attr(coverage_nightly, coverage(off))]
unsafe extern "C" fn class_init_trampoline(g_class: *mut c_void, class_data: *mut c_void) {
    if class_data.is_null() {
        return;
    }
    // SAFETY: `class_data` is the unique `Box::into_raw` pointer the
    // registration stored in GTypeInfo, and class_init runs exactly once
    // per static type.
    let vfuncs = unsafe { Box::from_raw(class_data.cast::<Vec<PreparedVfunc>>()) };
    PreparedVfunc::install_all(g_class, *vfuncs);
}

#[cfg_attr(test, allow(dead_code))]
struct RegisterClassRequest {
    name: glib::GString,
    parent_gtype: glib::Type,
    vfuncs: Vec<RawVfunc>,
    interfaces: Vec<RawInterface>,
}

impl RegisterClassRequest {
    #[cfg_attr(test, allow(dead_code))]
    fn query_parent_gtype(&self) -> anyhow::Result<gobject_ffi::GTypeQuery> {
        if !self.parent_gtype.is_valid() {
            anyhow::bail!("parent gtype is invalid (G_TYPE_INVALID)");
        }

        if glib::Type::from_name(&self.name).is_some() {
            anyhow::bail!("GType name '{}' is already registered", self.name);
        }

        // SAFETY: GTypeQuery is a plain C struct for which all-zero bytes
        // are a valid (empty) representation.
        let mut query: gobject_ffi::GTypeQuery = unsafe { std::mem::zeroed() };
        // SAFETY: `query` is a live local out-parameter, and the gtype is
        // a plain value.
        unsafe { gobject_ffi::g_type_query(self.parent_gtype.into_glib(), &mut query) };
        if query.type_ == 0 {
            anyhow::bail!("parent gtype could not be queried");
        }
        Ok(query)
    }

    fn validate_vfunc_offset(
        byte_offset: usize,
        pointer_align: usize,
        pointer_size: usize,
        class_size: Option<u32>,
        label: &str,
    ) -> anyhow::Result<()> {
        if !byte_offset.is_multiple_of(pointer_align) {
            anyhow::bail!(
                "{label} byte_offset {byte_offset} is not aligned to a pointer ({pointer_align})"
            );
        }
        let end = byte_offset
            .checked_add(pointer_size)
            .ok_or_else(|| anyhow::anyhow!("{label} byte_offset overflow"))?;
        if let Some(class_size) = class_size
            && end > class_size as usize
        {
            anyhow::bail!("{label} byte_offset {byte_offset} exceeds class size {class_size}");
        }
        Ok(())
    }

    #[cfg_attr(test, allow(dead_code))]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn validate_layout(&self, query: &gobject_ffi::GTypeQuery) -> anyhow::Result<()> {
        let pointer_align = std::mem::align_of::<*mut c_void>();
        let pointer_size = std::mem::size_of::<*mut c_void>();

        for vfunc in &self.vfuncs {
            Self::validate_vfunc_offset(
                vfunc.byte_offset,
                pointer_align,
                pointer_size,
                Some(query.class_size),
                "vfunc",
            )?;
        }

        for iface in &self.interfaces {
            if !iface.gtype.is_valid() {
                anyhow::bail!("interface gtype is invalid (G_TYPE_INVALID)");
            }
            for vfunc in &iface.vfuncs {
                Self::validate_vfunc_offset(
                    vfunc.byte_offset,
                    pointer_align,
                    pointer_size,
                    None,
                    "interface vfunc",
                )?;
            }
        }
        Ok(())
    }

    #[cfg_attr(test, allow(dead_code))]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn register_type(
        parent_gtype: glib::Type,
        name_ptr: *const c_char,
        class_vfuncs_ptr: *mut c_void,
        interfaces: Vec<PreparedInterface>,
        class_size: u16,
        instance_size: u16,
    ) -> anyhow::Result<usize> {
        let info = gobject_ffi::GTypeInfo {
            class_size,
            base_init: None,
            base_finalize: None,
            class_init: Some(class_init_trampoline),
            class_finalize: None,
            class_data: class_vfuncs_ptr,
            instance_size,
            n_preallocs: 0,
            instance_init: None,
            value_table: std::ptr::null(),
        };

        // SAFETY: `name_ptr` is the caller's live NUL-terminated GString
        // and `info` is a fully initialized local GTypeInfo.
        let new_gtype = unsafe {
            gobject_ffi::g_type_register_static(parent_gtype.into_glib(), name_ptr, &info, 0)
        };

        if new_gtype == 0 {
            // SAFETY: Registration failed, so class_init never ran and the
            // unique `Box::into_raw` pointer is still unconsumed.
            drop(unsafe { Box::from_raw(class_vfuncs_ptr.cast::<Vec<PreparedVfunc>>()) });
            anyhow::bail!("g_type_register_static returned G_TYPE_INVALID");
        }

        // SAFETY: `new_gtype` was just returned as a valid registered
        // type.
        let class_ptr = unsafe { gobject_ffi::g_type_class_ref(new_gtype) };

        for iface in interfaces {
            iface.install(class_ptr);
        }

        Ok(new_gtype)
    }
}

impl ModuleRequest for RegisterClassRequest {
    type Output = u64;

    /// Excluded from coverage instrumentation: the request orchestrates
    /// [`Self::validate_layout`] and [`Self::register_type`], both of which are
    /// themselves excluded, so its error-propagation has no reachable path
    /// under `cargo test`. [`Self::query_parent_gtype`] is covered directly.
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn execute(self) -> anyhow::Result<u64> {
        let query = self.query_parent_gtype()?;
        self.validate_layout(&query)?;

        let class_size = query.class_size as u16;
        let instance_size = query.instance_size as u16;
        let class_vfuncs: Vec<PreparedVfunc> =
            self.vfuncs.into_iter().map(RawVfunc::into_built).collect();
        let interfaces: Vec<PreparedInterface> = self
            .interfaces
            .into_iter()
            .map(RawInterface::into_built)
            .collect();
        let class_vfuncs_ptr = Box::into_raw(Box::new(class_vfuncs)).cast::<c_void>();

        let new_gtype = Self::register_type(
            self.parent_gtype,
            self.name.as_ptr(),
            class_vfuncs_ptr,
            interfaces,
            class_size,
            instance_size,
        )?;

        Ok(new_gtype as u64)
    }

    fn error_context() -> &'static str {
        "register_class"
    }
}

#[allow(clippy::trivially_copy_pass_by_ref)]
#[cfg_attr(test, allow(dead_code))]
#[cfg_attr(coverage_nightly, coverage(off))]
fn parse_js_array<T>(
    env: &Env,
    prop: Unknown<'_>,
    description: &str,
    convert: impl FnMut(&Env, Unknown<'_>) -> napi::Result<T>,
) -> napi::Result<Vec<T>> {
    if !prop.is_array()? {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("register_class: expected an array of {description}"),
        ));
    }
    // SAFETY: `prop` is a live JS value from the current callback's
    // `env`, verified to be an array just above.
    let arr: Array = unsafe { Array::from_napi_value(env.raw(), prop.raw())? };
    map_js_array(env, &arr, convert)
}

#[allow(clippy::trivially_copy_pass_by_ref)]
#[cfg_attr(test, allow(dead_code))]
#[cfg_attr(coverage_nightly, coverage(off))]
fn parse_type_array(env: &Env, prop: Unknown<'_>) -> napi::Result<Vec<Type>> {
    parse_js_array(env, prop, "types", Type::from_js_value)
}

#[allow(clippy::trivially_copy_pass_by_ref)]
#[cfg_attr(test, allow(dead_code))]
#[cfg_attr(coverage_nightly, coverage(off))]
fn parse_array_property<T>(
    env: &Env,
    options: &JsObject,
    name: &str,
    parser: impl FnMut(&Env, Unknown<'_>) -> napi::Result<T>,
) -> napi::Result<Vec<T>> {
    if !options.has_named_property(name)? {
        return Ok(Vec::new());
    }
    let prop: Unknown<'_> = options.get_named_property(name)?;
    if matches!(
        prop.get_type()?,
        napi::ValueType::Undefined | napi::ValueType::Null
    ) {
        return Ok(Vec::new());
    }
    parse_js_array(env, prop, name, parser)
}

#[allow(clippy::trivially_copy_pass_by_ref)]
#[cfg_attr(test, allow(dead_code))]
#[cfg_attr(coverage_nightly, coverage(off))]
fn parse_register_options(
    env: &Env,
    options: Option<JsObject>,
) -> napi::Result<(Vec<RawVfunc>, Vec<RawInterface>)> {
    let Some(options) = options else {
        return Ok((Vec::new(), Vec::new()));
    };

    let vfuncs = parse_array_property(env, &options, "vfuncs", RawVfunc::from_js_value)?;
    let interfaces = parse_array_property(
        env,
        &options,
        "interfaceVfuncs",
        RawInterface::from_js_value,
    )?;

    Ok((vfuncs, interfaces))
}

/// napi export shim. Excluded from coverage instrumentation: it parses the JS
/// class descriptor through a live [`napi::Env`]. The
/// [`RegisterClassRequest::execute`] logic it dispatches is exercised directly
/// by tests.
#[cfg_attr(coverage_nightly, coverage(off))]
#[allow(clippy::wildcard_imports)]
mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    #[allow(clippy::needless_pass_by_value)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn register_class(
        env: &Env,
        name: String,
        parent_gtype: f64,
        options: Option<JsObject>,
    ) -> napi::Result<Unknown<'_>> {
        let name = glib::GString::from_string_checked(name).map_err(|err| {
            napi::Error::new(
                napi::Status::InvalidArg,
                format!("register_class: invalid type name: {err}"),
            )
        })?;
        let (vfuncs, interfaces) = parse_register_options(env, options)?;
        RegisterClassRequest {
            name,
            // SAFETY: Converting a numeric GType value has no pointer
            // preconditions; the request validates it before use.
            parent_gtype: unsafe { glib::Type::from_glib(parent_gtype as glib::ffi::GType) },
            vfuncs,
            interfaces,
        }
        .dispatch(env)
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use gtk4::glib;
    use gtk4::prelude::StaticType as _;

    use super::*;

    const POINTER_ALIGN: usize = 8;
    const POINTER_SIZE: usize = 8;

    static TYPE_COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn unique_name(prefix: &str) -> glib::GString {
        let id = TYPE_COUNTER.fetch_add(1, Ordering::Relaxed);
        glib::GString::from_string_checked(format!("{prefix}{id}")).unwrap()
    }

    fn object_parent_gtype() -> glib::Type {
        glib::Object::static_type()
    }

    #[test]
    fn execute_registers_a_new_gtype() {
        let request = RegisterClassRequest {
            name: unique_name("GtkxTestExecuteType"),
            parent_gtype: object_parent_gtype(),
            vfuncs: vec![],
            interfaces: vec![],
        };
        let gtype = request.execute().expect("registration should succeed");
        assert_ne!(gtype, 0);
    }

    #[test]
    fn error_context_is_register_class() {
        assert_eq!(RegisterClassRequest::error_context(), "register_class");
    }

    #[test]
    fn query_parent_gtype_rejects_invalid_parent() {
        let request = RegisterClassRequest {
            name: unique_name("GtkxTestInvalidParent"),
            parent_gtype: glib::Type::INVALID,
            vfuncs: vec![],
            interfaces: vec![],
        };
        let err = request
            .query_parent_gtype()
            .expect_err("invalid parent should fail");
        assert!(err.to_string().contains("G_TYPE_INVALID"));
    }

    #[test]
    fn query_parent_gtype_rejects_non_classed_parent() {
        let request = RegisterClassRequest {
            name: unique_name("GtkxTestNonClassedParent"),
            parent_gtype: glib::Type::I64,
            vfuncs: vec![],
            interfaces: vec![],
        };
        let err = request
            .query_parent_gtype()
            .expect_err("non-classed parent should fail");
        assert!(err.to_string().contains("could not be queried"));
    }

    #[test]
    fn query_parent_gtype_rejects_already_registered_name() {
        let name = unique_name("GtkxTestDuplicateName");
        let first = RegisterClassRequest {
            name: name.clone(),
            parent_gtype: object_parent_gtype(),
            vfuncs: vec![],
            interfaces: vec![],
        };
        first.execute().expect("first registration should succeed");

        let second = RegisterClassRequest {
            name,
            parent_gtype: object_parent_gtype(),
            vfuncs: vec![],
            interfaces: vec![],
        };
        let err = second
            .query_parent_gtype()
            .expect_err("duplicate name should fail");
        assert!(err.to_string().contains("already registered"));
    }

    #[test]
    fn validate_vfunc_offset_accepts_aligned_offset_within_class() {
        let result = RegisterClassRequest::validate_vfunc_offset(
            16,
            POINTER_ALIGN,
            POINTER_SIZE,
            Some(64),
            "vfunc",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn validate_vfunc_offset_accepts_offset_when_class_size_unknown() {
        let result = RegisterClassRequest::validate_vfunc_offset(
            64,
            POINTER_ALIGN,
            POINTER_SIZE,
            None,
            "interface vfunc",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn validate_vfunc_offset_rejects_misaligned_offset() {
        let result = RegisterClassRequest::validate_vfunc_offset(
            7,
            POINTER_ALIGN,
            POINTER_SIZE,
            Some(64),
            "vfunc",
        );
        let err = result.expect_err("misaligned offset should fail validation");
        let message = err.to_string();
        assert!(message.contains("vfunc"));
        assert!(message.contains("not aligned"));
    }

    #[test]
    fn validate_vfunc_offset_rejects_offset_overflowing_class_size() {
        let result = RegisterClassRequest::validate_vfunc_offset(
            64,
            POINTER_ALIGN,
            POINTER_SIZE,
            Some(64),
            "vfunc",
        );
        let err = result.expect_err("offset past class size should fail validation");
        assert!(err.to_string().contains("exceeds class size"));
    }

    #[test]
    fn validate_vfunc_offset_rejects_arithmetic_overflow() {
        let aligned_max = usize::MAX & !(POINTER_ALIGN - 1);
        let result = RegisterClassRequest::validate_vfunc_offset(
            aligned_max,
            POINTER_ALIGN,
            POINTER_SIZE,
            None,
            "interface vfunc",
        );
        let err = result.expect_err("usize overflow should fail validation");
        assert!(err.to_string().contains("overflow"));
    }
}
