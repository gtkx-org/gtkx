use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi::sys;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BufferViewKind {
    Int8,
    Uint8,
    Uint8Clamped,
    Int16,
    Uint16,
    Int32,
    Uint32,
    Float32,
    Float64,
    BigInt64,
    BigUint64,
    DataView,
}

impl TryFrom<sys::napi_typedarray_type> for BufferViewKind {
    type Error = napi::Error;

    fn try_from(raw: sys::napi_typedarray_type) -> napi::Result<Self> {
        match raw {
            sys::TypedarrayType::int8_array => Ok(Self::Int8),
            sys::TypedarrayType::uint8_array => Ok(Self::Uint8),
            sys::TypedarrayType::uint8_clamped_array => Ok(Self::Uint8Clamped),
            sys::TypedarrayType::int16_array => Ok(Self::Int16),
            sys::TypedarrayType::uint16_array => Ok(Self::Uint16),
            sys::TypedarrayType::int32_array => Ok(Self::Int32),
            sys::TypedarrayType::uint32_array => Ok(Self::Uint32),
            sys::TypedarrayType::float32_array => Ok(Self::Float32),
            sys::TypedarrayType::float64_array => Ok(Self::Float64),
            sys::TypedarrayType::bigint64_array => Ok(Self::BigInt64),
            sys::TypedarrayType::biguint64_array => Ok(Self::BigUint64),
            other => Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("Unsupported typed-array type tag: {other}"),
            )),
        }
    }
}

impl BufferViewKind {
    pub fn element_size(self) -> usize {
        match self {
            Self::Int8 | Self::Uint8 | Self::Uint8Clamped | Self::DataView => 1,
            Self::Int16 | Self::Uint16 => 2,
            Self::Int32 | Self::Uint32 | Self::Float32 => 4,
            Self::Float64 | Self::BigInt64 | Self::BigUint64 => 8,
        }
    }
}

impl std::fmt::Display for BufferViewKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::Int8 => "Int8Array",
            Self::Uint8 => "Uint8Array",
            Self::Uint8Clamped => "Uint8ClampedArray",
            Self::Int16 => "Int16Array",
            Self::Uint16 => "Uint16Array",
            Self::Int32 => "Int32Array",
            Self::Uint32 => "Uint32Array",
            Self::Float32 => "Float32Array",
            Self::Float64 => "Float64Array",
            Self::BigInt64 => "BigInt64Array",
            Self::BigUint64 => "BigUint64Array",
            Self::DataView => "DataView",
        };
        write!(f, "{name}")
    }
}

#[derive(Debug, Clone, Copy)]
pub struct BufferView {
    ptr: *mut c_void,
    byte_length: usize,
    length: usize,
    kind: BufferViewKind,
}

unsafe impl Send for BufferView {}
unsafe impl Sync for BufferView {}

impl BufferView {
    pub fn new(ptr: *mut c_void, byte_length: usize, length: usize, kind: BufferViewKind) -> Self {
        Self {
            ptr,
            byte_length,
            length,
            kind,
        }
    }

    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }

    pub fn byte_length(&self) -> usize {
        self.byte_length
    }

    pub fn length(&self) -> usize {
        self.length
    }

    pub fn kind(&self) -> BufferViewKind {
        self.kind
    }
}

impl BufferView {
    pub(super) fn from_typed_array(env: &Env, value: &Unknown<'_>) -> napi::Result<Self> {
        let mut raw_kind: sys::napi_typedarray_type = sys::TypedarrayType::int8_array;
        let mut length = 0usize;
        let mut data = std::ptr::null_mut();
        let mut array_buffer = std::ptr::null_mut();
        let mut byte_offset = 0usize;
        let status = unsafe {
            sys::napi_get_typedarray_info(
                env.raw(),
                value.raw(),
                &mut raw_kind,
                &mut length,
                &mut data,
                &mut array_buffer,
                &mut byte_offset,
            )
        };
        check_status!(status, "Failed to read typed-array info")?;
        let kind = BufferViewKind::try_from(raw_kind)?;
        Self::reject_if_shared(env, array_buffer)?;
        Ok(Self::new(data, length * kind.element_size(), length, kind))
    }

    pub(super) fn from_data_view(env: &Env, value: &Unknown<'_>) -> napi::Result<Self> {
        let mut byte_length = 0usize;
        let mut data = std::ptr::null_mut();
        let mut array_buffer = std::ptr::null_mut();
        let mut byte_offset = 0usize;
        let status = unsafe {
            sys::napi_get_dataview_info(
                env.raw(),
                value.raw(),
                &mut byte_length,
                &mut data,
                &mut array_buffer,
                &mut byte_offset,
            )
        };
        check_status!(status, "Failed to read DataView info")?;
        Self::reject_if_shared(env, array_buffer)?;
        Ok(Self::new(
            data,
            byte_length,
            byte_length,
            BufferViewKind::DataView,
        ))
    }

    fn reject_if_shared(env: &Env, buffer: sys::napi_value) -> napi::Result<()> {
        let mut is_array_buffer = false;
        let status = unsafe { sys::napi_is_arraybuffer(env.raw(), buffer, &mut is_array_buffer) };
        check_status!(status, "Failed to inspect a view's backing buffer")?;
        if !is_array_buffer {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "SharedArrayBuffer-backed views cannot cross the FFI boundary",
            ));
        }
        Ok(())
    }
}
