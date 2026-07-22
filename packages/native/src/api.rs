pub mod alloc;
pub mod bind;
pub mod call;
pub mod copy;
pub mod get_type;
pub mod get_wrapper;
pub mod init;
pub mod keep_alive;
pub mod quit;
pub mod read;
pub mod register_class;
pub mod resolve_type;
pub mod set_wrapper;
pub mod write;

pub(crate) fn native_result<T>(context: &str, result: anyhow::Result<T>) -> napi::Result<T> {
    result.map_err(|error| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Error during {context}: {error:#}"),
        )
    })
}
