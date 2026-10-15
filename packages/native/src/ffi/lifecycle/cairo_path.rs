use std::ffi::c_void;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::FunctionResolver;
use crate::handle::BoxedFreeFn;

/// Lazy native operations used to copy a foreign record without executing ownership code in JavaScript.
#[derive(Debug)]
#[napi(object, object_to_js = false)]
pub struct RecordConverterOptions {
    #[napi(ts_type = "'cairo-path'")]
    pub kind: String,
    #[napi(ts_type = "() => ExternalObject<Handle>")]
    pub surface_create: FunctionResolver,
    #[napi(ts_type = "() => ExternalObject<Handle>")]
    pub surface_destroy: FunctionResolver,
    #[napi(ts_type = "() => ExternalObject<Handle>")]
    pub context_create: FunctionResolver,
    #[napi(ts_type = "() => ExternalObject<Handle>")]
    pub context_destroy: FunctionResolver,
    #[napi(ts_type = "() => ExternalObject<Handle>")]
    pub append_path: FunctionResolver,
    #[napi(ts_type = "() => ExternalObject<Handle>")]
    pub copy_path: FunctionResolver,
    #[napi(ts_type = "() => ExternalObject<Handle>")]
    pub context_status: FunctionResolver,
    #[napi(ts_type = "() => ExternalObject<Handle>")]
    pub path_destroy: FunctionResolver,
}

#[derive(Debug)]
pub(super) struct CairoPathCopy(RecordConverterOptions);

type SurfaceCreate = unsafe extern "C" fn(i32, i32, i32) -> *mut c_void;
type ContextCreate = unsafe extern "C" fn(*mut c_void) -> *mut c_void;
type AppendPath = unsafe extern "C" fn(*mut c_void, *const c_void);
type CopyPath = unsafe extern "C" fn(*mut c_void) -> *mut c_void;
type ContextStatus = unsafe extern "C" fn(*mut c_void) -> i32;

struct OwnedPointer {
    ptr: *mut c_void,
    free: BoxedFreeFn,
}

impl OwnedPointer {
    fn new(ptr: *mut c_void, free: BoxedFreeFn, label: &str) -> anyhow::Result<Self> {
        anyhow::ensure!(!ptr.is_null(), "Cairo could not allocate a {label}");
        Ok(Self { ptr, free })
    }

    fn into_raw(mut self) -> *mut c_void {
        std::mem::replace(&mut self.ptr, std::ptr::null_mut())
    }
}

impl Drop for OwnedPointer {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            unsafe { (self.free)(self.ptr) };
        }
    }
}

impl CairoPathCopy {
    pub(super) fn new(options: RecordConverterOptions) -> Result<Self> {
        if options.kind != "cairo-path" {
            return Err(Error::new(
                Status::InvalidArg,
                format!("Unsupported native record copy strategy '{}'", options.kind),
            ));
        }
        Ok(Self(options))
    }

    pub(super) fn copy(
        &self,
        source: *mut c_void,
        expected_free: BoxedFreeFn,
    ) -> anyhow::Result<*mut c_void> {
        let operations = &self.0;
        let surface_create = unsafe { operations.surface_create.get::<SurfaceCreate>()? };
        let surface_destroy = unsafe { operations.surface_destroy.get::<BoxedFreeFn>()? };
        let context_create = unsafe { operations.context_create.get::<ContextCreate>()? };
        let context_destroy = unsafe { operations.context_destroy.get::<BoxedFreeFn>()? };
        let append_path = unsafe { operations.append_path.get::<AppendPath>()? };
        let copy_path = unsafe { operations.copy_path.get::<CopyPath>()? };
        let context_status = unsafe { operations.context_status.get::<ContextStatus>()? };
        let path_destroy = unsafe { operations.path_destroy.get::<BoxedFreeFn>()? };
        anyhow::ensure!(
            std::ptr::fn_addr_eq(path_destroy, expected_free),
            "A converted record must have the declared native release operation"
        );

        let surface = OwnedPointer::new(
            unsafe { surface_create(0, 1, 1) },
            surface_destroy,
            "copy surface",
        )?;
        let context = OwnedPointer::new(
            unsafe { context_create(surface.ptr) },
            context_destroy,
            "copy context",
        )?;
        unsafe { append_path(context.ptr, source.cast_const()) };
        let status = unsafe { context_status(context.ptr) };
        anyhow::ensure!(status == 0, "Cairo path copy failed with status {status}");
        let copied =
            OwnedPointer::new(unsafe { copy_path(context.ptr) }, path_destroy, "path copy")?;
        let status = unsafe { copied.ptr.cast::<i32>().read() };
        anyhow::ensure!(status == 0, "Cairo path copy failed with status {status}");

        Ok(copied.into_raw())
    }
}
