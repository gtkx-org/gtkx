use std::cell::Cell;
use std::ffi::c_void;

use libffi::middle as libffi;

use crate::ffi::closure::{ClosureData, ClosureState};

mod storage;

pub use storage::{
    CallerAllocation, GArrayData, GLIST_OPS, GPtrArrayData, GSLIST_OPS, HashTableData, ListData,
    ListNode, ListOps, ListPayload, PendingTransfer, ReleaseKind, StashData, StashStorage,
    build_list,
};

#[derive(Debug)]
pub enum Stash {
    U8(u8),
    I8(i8),
    U16(u16),
    I16(i16),
    U32(u32),
    I32(i32),
    U64(u64),
    I64(i64),
    F32(f32),
    F64(f64),
    Ptr(*mut c_void),
    Storage(StashStorage),
    Callback(CallbackValue),
    Void,
}

pub struct CallbackValue {
    fn_ptr: *mut c_void,
    state_ptr: *mut c_void,
    has_user_data: bool,
    destroy_ptr: Option<*mut c_void>,
    held_state: Option<*mut ClosureState>,
    pending_transfer: Cell<Option<*mut ClosureState>>,
}

impl CallbackValue {
    pub fn new(
        fn_ptr: *mut c_void,
        state_ptr: *mut c_void,
        has_user_data: bool,
        destroy_ptr: Option<*mut c_void>,
        owned_state: Option<Box<ClosureState>>,
    ) -> Self {
        Self {
            fn_ptr,
            state_ptr,
            has_user_data,
            destroy_ptr,
            held_state: owned_state.map(Box::into_raw),
            pending_transfer: Cell::new(None),
        }
    }

    pub fn new_pending_transfer(
        fn_ptr: *mut c_void,
        has_user_data: bool,
        destroy_ptr: Option<*mut c_void>,
        state: Box<ClosureState>,
    ) -> Self {
        let state_ptr = Box::into_raw(state);
        unsafe {
            (*state_ptr).data_ref().state_ptr.set(state_ptr);
            (*state_ptr).hold();
        }
        Self {
            fn_ptr,
            state_ptr: state_ptr.cast(),
            has_user_data,
            destroy_ptr,
            held_state: Some(state_ptr),
            pending_transfer: Cell::new(Some(state_ptr)),
        }
    }

    pub fn disarm_pending_transfer(&self) {
        self.pending_transfer.take();
    }

    /// Keeps the closure reachable for the life of the process, for a callback whose C side
    /// never hands back anything that could identify it for release.
    pub fn retain_forever(&self) {
        if let Some(state_ptr) = self.held_state {
            ClosureState::retain_forever(state_ptr);
        }
    }

    pub fn closure_data(&self) -> Option<&ClosureData> {
        self.held_state.map(|state| unsafe { (*state).data_ref() })
    }
}

impl Drop for CallbackValue {
    fn drop(&mut self) {
        if let Some(state_ptr) = self.pending_transfer.take() {
            unsafe { ClosureState::release(state_ptr) };
        }
        if let Some(state_ptr) = self.held_state {
            unsafe { ClosureState::release(state_ptr) };
        }
    }
}

impl std::fmt::Debug for CallbackValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CallbackValue")
            .field("fn_ptr", &self.fn_ptr)
            .field("state_ptr", &self.state_ptr)
            .field("destroy_ptr", &self.destroy_ptr)
            .finish_non_exhaustive()
    }
}

macro_rules! ffi_numeric_with {
    ($($rest:pat_param)|*) => {
        Self::U8(_)
            | Self::I8(_)
            | Self::U16(_)
            | Self::I16(_)
            | Self::U32(_)
            | Self::I32(_)
            | Self::U64(_)
            | Self::I64(_)
            | Self::F32(_)
            | Self::F64(_)
            $(| $rest)*
    };
}

impl Stash {
    pub fn disarm_pending_transfer(&self) {
        match self {
            Self::Storage(storage) => storage.disarm_pending_transfer(),
            Self::Callback(callback) => callback.disarm_pending_transfer(),
            _ => {}
        }
    }

    pub fn owns_element_buffer(&self) -> bool {
        matches!(self, Self::Storage(storage) if storage.owns_element_buffer())
    }

    /// # Safety
    ///
    /// `slot` must be non-null and point to at least as many writable bytes as the scalar
    /// variant held by `self` occupies (1 for `U8`/`I8` up to 8 for `U64`/`I64`/`F64`), and the
    /// caller must have exclusive access to those bytes for the duration of the call. Alignment
    /// is not required: the write is unaligned. Nothing is written for the non-scalar variants,
    /// which return an error instead.
    pub unsafe fn write_scalar_to_ptr(&self, slot: *mut c_void) -> anyhow::Result<()> {
        match self {
            Self::U8(value) => unsafe { slot.cast::<u8>().write_unaligned(*value) },
            Self::I8(value) => unsafe { slot.cast::<i8>().write_unaligned(*value) },
            Self::U16(value) => unsafe { slot.cast::<u16>().write_unaligned(*value) },
            Self::I16(value) => unsafe { slot.cast::<i16>().write_unaligned(*value) },
            Self::U32(value) => unsafe { slot.cast::<u32>().write_unaligned(*value) },
            Self::I32(value) => unsafe { slot.cast::<i32>().write_unaligned(*value) },
            Self::U64(value) => unsafe { slot.cast::<u64>().write_unaligned(*value) },
            Self::I64(value) => unsafe { slot.cast::<i64>().write_unaligned(*value) },
            Self::F32(value) => unsafe { slot.cast::<f32>().write_unaligned(*value) },
            Self::F64(value) => unsafe { slot.cast::<f64>().write_unaligned(*value) },
            Self::Ptr(_) | Self::Storage(_) | Self::Callback(_) | Self::Void => {
                anyhow::bail!("{self:?} has no scalar payload for an out-parameter slot")
            }
        }
        Ok(())
    }

    pub fn as_ptr(&self, type_name: &str) -> anyhow::Result<*mut c_void> {
        match self {
            Self::Ptr(ptr) => Ok(*ptr),
            Self::Storage(storage) => Ok(storage.ptr()),
            ffi_numeric_with!(Self::Callback(_) | Self::Void) => {
                anyhow::bail!("Expected a pointer Stash for {type_name}, got {self:?}")
            }
        }
    }

    pub fn as_non_null_ptr(&self, type_name: &str) -> anyhow::Result<Option<*mut c_void>> {
        let ptr = self.as_ptr(type_name)?;
        Ok(if ptr.is_null() { None } else { Some(ptr) })
    }

    pub fn as_storage_or_null(&self, kind: &str) -> anyhow::Result<Option<&StashStorage>> {
        match self {
            Self::Storage(storage) => Ok(Some(storage)),
            Self::Ptr(ptr) if ptr.is_null() => Ok(None),
            _ => anyhow::bail!("Expected a Storage ffi::Stash for {kind}, got {self:?}"),
        }
    }

    pub fn to_number(&self) -> anyhow::Result<f64> {
        match self {
            Self::I8(value) => Ok(f64::from(*value)),
            Self::U8(value) => Ok(f64::from(*value)),
            Self::I16(value) => Ok(f64::from(*value)),
            Self::U16(value) => Ok(f64::from(*value)),
            Self::I32(value) => Ok(f64::from(*value)),
            Self::U32(value) => Ok(f64::from(*value)),
            Self::I64(value) => crate::ffi::codec::lossless_f64(i128::from(*value), "call result"),
            Self::U64(value) => crate::ffi::codec::lossless_f64(i128::from(*value), "call result"),
            Self::F32(value) => Ok(f64::from(*value)),
            Self::F64(value) => Ok(*value),
            Self::Ptr(_) | Self::Storage(_) | Self::Callback(_) | Self::Void => {
                anyhow::bail!("Expected a numeric Stash, got {self:?}")
            }
        }
    }

    pub fn append_libffi_args<'a>(&'a self, args: &mut Vec<libffi::Arg<'a>>) {
        match self {
            Self::Callback(callback) => {
                args.push(libffi::arg(&callback.fn_ptr));
                if callback.has_user_data {
                    args.push(libffi::arg(&callback.state_ptr));
                }
                if let Some(destroy_ptr) = &callback.destroy_ptr {
                    args.push(libffi::arg(destroy_ptr));
                }
            }
            ffi_numeric_with!(Self::Ptr(_) | Self::Storage(_) | Self::Void) => {
                args.push(self.into());
            }
        }
    }
}

impl<'a> From<&'a Stash> for libffi::Arg<'a> {
    fn from(arg: &'a Stash) -> Self {
        match arg {
            Stash::U8(value) => libffi::arg(value),
            Stash::I8(value) => libffi::arg(value),
            Stash::U16(value) => libffi::arg(value),
            Stash::I16(value) => libffi::arg(value),
            Stash::U32(value) => libffi::arg(value),
            Stash::I32(value) => libffi::arg(value),
            Stash::U64(value) => libffi::arg(value),
            Stash::I64(value) => libffi::arg(value),
            Stash::F32(value) => libffi::arg(value),
            Stash::F64(value) => libffi::arg(value),
            Stash::Ptr(ptr) => libffi::arg(ptr),
            Stash::Storage(storage) => libffi::arg(storage.ptr_ref()),
            Stash::Callback(_) => {
                unreachable!("Callback requires append_libffi_args for multiple arguments")
            }
            Stash::Void => libffi::arg(&()),
        }
    }
}
