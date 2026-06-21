use std::ffi::{c_char, c_void};
use std::sync::Arc;

use glib::{
    self, gobject_ffi,
    translate::{FromGlib as _, IntoGlib as _},
};
use napi::bindgen_prelude::*;
use napi::{Env, JsFunction, JsObject, NapiValue as _};
use napi_derive::napi;

use super::handler::ModuleRequest;
use crate::error_reporter::NativeErrorReporter;
use crate::trampoline::{TrampolineState, build_trampoline};
use crate::types::Type;
use crate::value::{JsRef, map_js_array};

#[cfg_attr(test, allow(dead_code))]
struct RawVfunc {
    byte_offset: usize,
    js_func: Arc<JsRef<JsFunction>>,
    arg_types: Vec<Type>,
    return_type: Type,
}

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
        // SAFETY: `handler_prop` was verified to be a function above, and its raw napi value is
        // valid for the current `env`, so reconstructing a `JsFunction` from the pair is sound.
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
        let (code_ptr, state) = build_trampoline(js_func, arg_types, return_type, None, false);
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
        let (_, gtype_value, gtype_lossless) = obj.get_named_property::<BigInt>("gtype")?.get_u64();
        if !gtype_lossless {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "register_class: interface gtype exceeds the 64-bit GType range",
            ));
        }
        // SAFETY: `gtype_value` is a losslessly decoded u64 GType handle from JS; `from_glib`
        // reinterprets it as a `glib::Type`, whose validity is checked immediately below.
        let gtype = unsafe { glib::Type::from_glib(gtype_value as glib::ffi::GType) };
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

#[cfg_attr(test, allow(dead_code))]
struct PreparedVfunc {
    byte_offset: usize,
    code_ptr: *mut c_void,
    state: Box<TrampolineState>,
}

#[cfg_attr(test, allow(dead_code))]
struct PreparedInterface {
    gtype: glib::Type,
    vfuncs: Vec<PreparedVfunc>,
}

impl PreparedVfunc {
    #[cfg_attr(test, allow(dead_code))]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn install_all(vtable_base: *mut c_void, vfuncs: Vec<Self>) {
        for vfunc in vfuncs {
            // SAFETY: `byte_offset` was validated against the class/interface size and pointer
            // alignment in `validate_vfunc_offset`, so `vtable_base + byte_offset` is an in-bounds,
            // pointer-aligned slot in this vtable. `slot.write` installs the trampoline code
            // pointer into that slot; `mem::forget` keeps the backing `TrampolineState` alive for
            // the lifetime of the registered type, which outlives any vfunc dispatch.
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
    #[cfg_attr(test, allow(dead_code))]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn install(self, class_ptr: *mut c_void) {
        // SAFETY: `class_ptr` is the live class struct returned by `g_type_class_ref` for the
        // just-registered type, and `self.gtype` is a valid interface GType; `g_type_interface_peek`
        // returns the interface vtable for that pairing or null if the type does not conform.
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
/// `GObject` `class_init` callback that installs the prepared class vfuncs into the new vtable.
///
/// # Safety
///
/// Invoked by `GObject` during type registration. `class_data` is the pointer stored in
/// `GTypeInfo::class_data` by `register_type` — either null or a `Box<Vec<PreparedVfunc>>` leaked
/// via `Box::into_raw` — and `g_class` is the class struct being initialized. This must be called
/// at most once per registered type so the boxed vfuncs are reclaimed exactly once.
unsafe extern "C" fn class_init_trampoline(g_class: *mut c_void, class_data: *mut c_void) {
    if class_data.is_null() {
        return;
    }
    // SAFETY: `class_data` is the non-null `Box<Vec<PreparedVfunc>>` raw pointer that
    // `register_type` stored in `GTypeInfo::class_data`; reclaiming it here transfers ownership
    // back so the vec is dropped after its vfuncs are installed.
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

        // SAFETY: `GTypeQuery` is a plain C struct of integers and a pointer, for which an
        // all-zero bit pattern is a valid initial state that `g_type_query` then fills in.
        let mut query: gobject_ffi::GTypeQuery = unsafe { std::mem::zeroed() };
        // SAFETY: `self.parent_gtype` was checked valid above; `g_type_query` writes the parent
        // type's layout into the writable `query` struct.
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

        // SAFETY: `parent_gtype` is valid, `name_ptr` points to the request's live NUL-terminated
        // `GString`, and `info` is a fully initialized `GTypeInfo` whose `class_data` owns the
        // boxed vfuncs that `class_init_trampoline` reclaims; the call runs on the gtkx-glib thread.
        let new_gtype = unsafe {
            gobject_ffi::g_type_register_static(parent_gtype.into_glib(), name_ptr, &info, 0)
        };

        if new_gtype == 0 {
            // SAFETY: registration failed before `class_init_trampoline` could run, so the boxed
            // vfuncs at `class_vfuncs_ptr` are still owned here; reclaiming and dropping them frees
            // them exactly once.
            drop(unsafe { Box::from_raw(class_vfuncs_ptr.cast::<Vec<PreparedVfunc>>()) });
            anyhow::bail!("g_type_register_static returned G_TYPE_INVALID");
        }

        // SAFETY: `new_gtype` is the valid type just registered; `g_type_class_ref` returns its
        // live class struct (and drives `class_init`), holding a class reference for the process.
        let class_ptr = unsafe { gobject_ffi::g_type_class_ref(new_gtype) };

        for iface in interfaces {
            iface.install(class_ptr);
        }

        Ok(new_gtype)
    }
}

impl ModuleRequest for RegisterClassRequest {
    type Output = u64;

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
    // SAFETY: `prop` was verified to be an array above, and its raw napi value is valid for the
    // current `env`, so reconstructing an `Array` from the pair is sound.
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
    let interfaces =
        parse_array_property(env, &options, "interfaces", RawInterface::from_js_value)?;

    Ok((vfuncs, interfaces))
}

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
        parent_gtype: BigInt,
        options: Option<JsObject>,
    ) -> napi::Result<Unknown<'_>> {
        let name = glib::GString::from_string_checked(name).map_err(|err| {
            napi::Error::new(
                napi::Status::InvalidArg,
                format!("register_class: invalid type name: {err}"),
            )
        })?;
        let (_, parent_value, parent_lossless) = parent_gtype.get_u64();
        if !parent_lossless {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "register_class: parent gtype exceeds the 64-bit GType range",
            ));
        }
        let (vfuncs, interfaces) = parse_register_options(env, options)?;
        RegisterClassRequest {
            name,
            // SAFETY: `parent_value` is a losslessly decoded u64 GType handle from JS; `from_glib`
            // reinterprets it as a `glib::Type`, whose validity is enforced during execution.
            parent_gtype: unsafe { glib::Type::from_glib(parent_value as glib::ffi::GType) },
            vfuncs,
            interfaces,
        }
        .dispatch(env)
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

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
}
