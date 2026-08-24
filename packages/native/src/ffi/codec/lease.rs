use std::cell::OnceCell;

use libffi::middle as libffi;

use super::Codec;
use super::prelude::*;
use crate::ffi::library_cache::FfiCache;
use crate::handle::{
    Handle, Lease, LeaseGetUserDataFn, LeaseIdentityApi, LeaseKind, LeaseReleaseFn,
    LeaseSetUserDataFn,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LeaseAction {
    Result,
    End,
    Guard,
    Access,
    Alias,
}

impl LeaseAction {
    pub(crate) fn parse(action: &str) -> anyhow::Result<Self> {
        match action {
            "result" => Ok(Self::Result),
            "end" => Ok(Self::End),
            "guard" => Ok(Self::Guard),
            "access" => Ok(Self::Access),
            "alias" => Ok(Self::Alias),
            _ => anyhow::bail!("Unknown lease action '{action}'"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct LeaseCodec {
    inner_codec: Box<Codec>,
    action: LeaseAction,
    kind: LeaseKind,
    owner_param_index: Option<usize>,
    release: OnceCell<LeaseReleaseFn>,
    get_user_data: OnceCell<LeaseGetUserDataFn>,
    set_user_data: OnceCell<LeaseSetUserDataFn>,
}

impl LeaseCodec {
    pub(crate) fn new(
        inner_codec: Codec,
        action: LeaseAction,
        shared_library: String,
        release_fn_name: String,
        owner_param_index: Option<usize>,
        get_user_data_fn_name: Option<String>,
        set_user_data_fn_name: Option<String>,
    ) -> anyhow::Result<Self> {
        let supports_action = match action {
            LeaseAction::Access => {
                matches!(inner_codec, Codec::Boxed(_) | Codec::Struct(_))
                    && inner_codec.transfer().is_borrowed()
            }
            LeaseAction::Alias => {
                matches!(inner_codec, Codec::Boxed(_)) && inner_codec.transfer().is_full()
            }
            LeaseAction::Result | LeaseAction::End | LeaseAction::Guard => {
                matches!(inner_codec, Codec::Boxed(_)) && inner_codec.transfer().is_borrowed()
            }
        };
        anyhow::ensure!(
            supports_action,
            "A lease action cannot wrap this descriptor"
        );
        match action {
            LeaseAction::Result | LeaseAction::End | LeaseAction::Alias => {
                anyhow::ensure!(
                    owner_param_index.is_some(),
                    "A result, end, or alias lease needs an owner parameter"
                );
            }
            LeaseAction::Guard | LeaseAction::Access => {
                anyhow::ensure!(
                    owner_param_index.is_none(),
                    "A guard or access lease cannot name an owner parameter"
                );
            }
        }

        let kind = LeaseKind::new(
            shared_library,
            release_fn_name,
            get_user_data_fn_name,
            set_user_data_fn_name,
        )?;
        anyhow::ensure!(
            action != LeaseAction::Alias || kind.identity().is_some(),
            "A lease alias needs native user-data functions"
        );

        Ok(Self {
            inner_codec: Box::new(inner_codec),
            action,
            kind,
            owner_param_index,
            release: OnceCell::new(),
            get_user_data: OnceCell::new(),
            set_user_data: OnceCell::new(),
        })
    }

    pub(crate) fn inner_codec(&self) -> &Codec {
        &self.inner_codec
    }

    pub(crate) fn action(&self) -> LeaseAction {
        self.action
    }

    pub(crate) fn kind(&self) -> &LeaseKind {
        &self.kind
    }

    pub(crate) fn owner_param_index(&self) -> Option<usize> {
        self.owner_param_index
    }

    fn input_handle(value: Unknown<'_>) -> anyhow::Result<Option<Handle>> {
        match value.get_type()? {
            ValueType::External => {
                let external: &External<Handle> = value::read_napi(value)?;
                anyhow::ensure!(
                    !external.is_invalidated(),
                    "The lease handle refers to nothing: {}",
                    crate::handle::INVALIDATED_HANDLE
                );

                Ok(Some(Handle::clone(external)))
            }
            ValueType::Null | ValueType::Undefined => Ok(None),
            other => anyhow::bail!("Expected an Object for lease type, got {other:?}"),
        }
    }

    fn guard_stash(&self, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let Some(handle) = Self::input_handle(value)? else {
            return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
        };
        let ptr = handle.as_ptr();
        let identity = self.identity_api()?;
        Lease::ensure_available(&self.kind, ptr, identity.as_ref())?;
        anyhow::ensure!(
            handle.is_owned_boxed(),
            "A lease owner must be an independently retained boxed value"
        );

        Ok(ffi::Stash::Storage(ffi::StashStorage::retaining_handle(
            ptr, handle,
        )))
    }

    fn end_stash(value: Unknown<'_>, kind: &LeaseKind) -> anyhow::Result<ffi::Stash> {
        let handle = Self::input_handle(value)?
            .ok_or_else(|| anyhow::anyhow!("A lease end value must not be null"))?;
        let ptr = handle.as_ptr();
        let lease = Lease::find(kind, ptr).ok_or_else(|| {
            anyhow::anyhow!("The value does not belong to an active lease of this kind")
        })?;
        anyhow::ensure!(
            lease.value_ptr() == ptr,
            "A lease can only end through its leased result value"
        );

        Ok(ffi::Stash::Storage(ffi::StashStorage::retaining_handle(
            ptr,
            Handle::leased(lease),
        )))
    }

    fn access_stash(&self, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let Some(handle) = Self::input_handle(value)? else {
            return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
        };
        let ptr = handle.as_ptr();
        let identity = self.identity_api()?;
        Lease::ensure_accessible(&self.kind, ptr, identity.as_ref())?;

        Ok(ffi::Stash::Storage(ffi::StashStorage::retaining_handle(
            ptr, handle,
        )))
    }

    fn release_fn(&self) -> anyhow::Result<LeaseReleaseFn> {
        if let Some(release) = self.release.get() {
            return Ok(*release);
        }

        let release = FfiCache::with(|state| unsafe {
            state.resolve_symbol::<LeaseReleaseFn>(
                self.kind.shared_library(),
                self.kind.release_fn_name(),
            )
        })?;
        let _ = self.release.set(release);

        Ok(release)
    }

    fn identity_api(&self) -> anyhow::Result<Option<LeaseIdentityApi>> {
        let (Some(get_name), Some(set_name), Some(identity)) = (
            self.kind.get_user_data_fn_name(),
            self.kind.set_user_data_fn_name(),
            self.kind.identity(),
        ) else {
            return Ok(None);
        };

        let get_user_data = if let Some(get_user_data) = self.get_user_data.get() {
            *get_user_data
        } else {
            let get_user_data = FfiCache::with(|state| unsafe {
                state.resolve_symbol::<LeaseGetUserDataFn>(self.kind.shared_library(), get_name)
            })?;
            let _ = self.get_user_data.set(get_user_data);
            get_user_data
        };
        let set_user_data = if let Some(set_user_data) = self.set_user_data.get() {
            *set_user_data
        } else {
            let set_user_data = FfiCache::with(|state| unsafe {
                state.resolve_symbol::<LeaseSetUserDataFn>(self.kind.shared_library(), set_name)
            })?;
            let _ = self.set_user_data.set(set_user_data);
            set_user_data
        };

        Ok(Some(LeaseIdentityApi::new(
            identity,
            get_user_data,
            set_user_data,
        )))
    }

    pub(crate) fn prepare_result(&self) -> anyhow::Result<()> {
        match self.action {
            LeaseAction::Result => {
                self.release_fn()?;
                self.identity_api()?;
            }
            LeaseAction::Alias => {
                self.identity_api()?.ok_or_else(|| {
                    anyhow::anyhow!("A lease alias has no native user-data functions")
                })?;
            }
            LeaseAction::End | LeaseAction::Guard | LeaseAction::Access => {}
        }
        Ok(())
    }

    fn end_lease(stash: &ffi::Stash) -> anyhow::Result<&Lease> {
        let ffi::Stash::Storage(storage) = stash else {
            anyhow::bail!("A lease end argument was not marshalled as retained storage")
        };
        let lease = storage
            .retained_handle()
            .and_then(Handle::as_lease)
            .ok_or_else(|| {
                anyhow::anyhow!("A lease end argument did not retain its active lease")
            })?;

        Ok(lease)
    }

    pub(crate) fn validate_end(
        &self,
        stash: &ffi::Stash,
        args: &[ffi::Stash],
    ) -> anyhow::Result<()> {
        if self.action != LeaseAction::End {
            return Ok(());
        }
        let owner_index = self
            .owner_param_index
            .ok_or_else(|| anyhow::anyhow!("A lease end has no owner parameter"))?;
        let owner_ptr = args
            .get(owner_index)
            .ok_or_else(|| anyhow::anyhow!("A lease end owner parameter is out of range"))?
            .as_ptr("lease owner")?;
        let lease = Self::end_lease(stash)?;
        anyhow::ensure!(
            lease.kind() == &self.kind,
            "The active lease has a different kind"
        );
        anyhow::ensure!(
            lease.owner_ptr() == owner_ptr,
            "The value is leased from a different owner"
        );

        Ok(())
    }

    pub(crate) fn validate_result_owner(&self, args: &[ffi::Stash]) -> anyhow::Result<()> {
        if !matches!(self.action, LeaseAction::Result | LeaseAction::Alias) {
            return Ok(());
        }
        let owner_index = self
            .owner_param_index
            .ok_or_else(|| anyhow::anyhow!("A lease return has no owner parameter"))?;
        let owner = Self::result_owner(args, owner_index)?;
        anyhow::ensure!(
            !owner.as_ptr().is_null(),
            "A lease return owner must refer to a live value"
        );

        Ok(())
    }

    pub(crate) fn commit_end(&self, stash: &ffi::Stash) {
        if self.action != LeaseAction::End {
            return;
        }
        if let Ok(lease) = Self::end_lease(stash) {
            lease.end();
        }
    }

    fn result_owner(args: &[ffi::Stash], index: usize) -> anyhow::Result<Handle> {
        let ffi::Stash::Storage(storage) = args
            .get(index)
            .ok_or_else(|| anyhow::anyhow!("A lease return owner parameter is out of range"))?
        else {
            anyhow::bail!("A lease return owner was not retained by its descriptor")
        };
        let handle = storage
            .retained_handle()
            .ok_or_else(|| anyhow::anyhow!("A lease return owner did not retain its handle"))?;

        Ok(handle.clone())
    }

    fn decode_result<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
    ) -> anyhow::Result<Unknown<'e>> {
        let Some(value_ptr) = stash.as_non_null_ptr("lease result")? else {
            return Ok(value::js_null(env)?);
        };
        let owner_index = self
            .owner_param_index
            .ok_or_else(|| anyhow::anyhow!("A lease result has no owner parameter"))?;
        let owner = Self::result_owner(ffi_args, owner_index)?;
        let release = self.release_fn()?;
        let identity = self.identity_api()?;

        match Lease::new(
            self.kind.clone(),
            owner,
            value_ptr,
            release,
            identity.as_ref(),
        ) {
            Ok(lease) => Ok(value::handle_to_unknown(env, Handle::leased(lease))?),
            Err(error) => {
                let owner_ptr = ffi_args[owner_index].as_ptr("lease owner")?;
                unsafe { release(owner_ptr, value_ptr) };
                Err(error)
            }
        }
    }

    fn decode_alias<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
    ) -> anyhow::Result<Unknown<'e>> {
        let Some(value_ptr) = stash.as_non_null_ptr("lease alias")? else {
            return Ok(value::js_null(env)?);
        };
        let owner_index = self
            .owner_param_index
            .ok_or_else(|| anyhow::anyhow!("A lease alias has no owner parameter"))?;
        let owner = Self::result_owner(ffi_args, owner_index)?;
        let Codec::Boxed(boxed) = self.inner_codec.as_ref() else {
            anyhow::bail!("A lease alias does not wrap a boxed descriptor")
        };
        let handle = boxed.adopted_or_struct(value_ptr)?;
        let identity = self
            .identity_api()?
            .ok_or_else(|| anyhow::anyhow!("A lease alias has no native user-data functions"))?;
        identity.link(owner.as_ptr(), value_ptr)?;

        Ok(value::handle_to_unknown(env, handle)?)
    }
}

impl Encoder for LeaseCodec {
    fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        match self.action {
            LeaseAction::Guard => self.guard_stash(value),
            LeaseAction::End => Self::end_stash(value, &self.kind),
            LeaseAction::Access => self.access_stash(value),
            LeaseAction::Result | LeaseAction::Alias => {
                anyhow::bail!("A lease return descriptor cannot encode an argument")
            }
        }
    }

    fn libffi_type(&self) -> libffi::Type {
        self.inner_codec.libffi_type()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        self.inner_codec.call_cif(cif, ptr, args)
    }
}

impl Decoder for LeaseCodec {
    fn decode_with_context<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
        _arg_codecs: &[Codec],
    ) -> anyhow::Result<Unknown<'e>> {
        match self.action {
            LeaseAction::Result => self.decode_result(env, stash, ffi_args),
            LeaseAction::Alias => self.decode_alias(env, stash, ffi_args),
            LeaseAction::End | LeaseAction::Guard | LeaseAction::Access => {
                anyhow::bail!("Only a lease result or alias descriptor can decode a return value")
            }
        }
    }
}

impl PtrWriter for LeaseCodec {}
