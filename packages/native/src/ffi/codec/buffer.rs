use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct BufferCodec;

impl Encoder for BufferCodec {
    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        if let Some(view) = value::TypedView::from_unknown(env, value)? {
            return Ok(ffi::Stash::Ptr(view.ptr()));
        }
        match value.get_type()? {
            ValueType::External => Ok(ffi::Stash::Ptr(value::opaque_ptr(value, "buffer")?)),
            ValueType::Null | ValueType::Undefined => Ok(ffi::Stash::Ptr(std::ptr::null_mut())),
            other => {
                bail_expected!(
                    format!("an ArrayBufferView, native handle, or null, got {other:?}"),
                    "buffer"
                )
            }
        }
    }

    fn encode_owned(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        match value::TypedView::from_unknown(env, value)? {
            Some(view) => Ok(ffi::Stash::Storage(owned_view_storage(&view))),
            None if value.get_type()? == ValueType::External => {
                let pointer = value::opaque_ptr(value, "buffer")?;
                let handle: &External<crate::handle::Handle> = value::read_napi(value)?;
                if handle.is_process_static() {
                    return Ok(ffi::Stash::Ptr(pointer));
                }
                let retained = handle.retain_owned()?;
                Ok(ffi::Stash::Storage(ffi::StashStorage::new(
                    pointer,
                    ffi::StashData::Handle(retained),
                )))
            }
            None => self.encode(env, value),
        }
    }

    reject_return_codec!("Buffer");
}

impl Decoder for BufferCodec {}

impl PtrWriter for BufferCodec {}
