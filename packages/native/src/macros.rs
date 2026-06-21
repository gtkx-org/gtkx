macro_rules! with_integer_kinds {
    ($callback:ident) => {
        $callback! {
            U8: u8: U8Vec,
            I8: i8: I8Vec,
            U16: u16: U16Vec,
            I16: i16: I16Vec,
            U32: u32: U32Vec,
            I32: i32: I32Vec,
            U64: u64: U64Vec,
            I64: i64: I64Vec,
        }
    };
}

/// Declares an item `pub` when the `test-support` feature exposes it to the in-crate test and
/// bench harness, and `pub(crate)` otherwise so the production surface stays internal.
macro_rules! test_visible {
    ($(#[$meta:meta])* fn $name:ident $($rest:tt)+) => {
        #[cfg(feature = "test-support")]
        $(#[$meta])* pub fn $name $($rest)+
        #[cfg(not(feature = "test-support"))]
        $(#[$meta])* pub(crate) fn $name $($rest)+
    };
}

/// Declares each named module `pub` under the `test-support` feature (so the in-crate test and
/// bench harness can reach internals through full module paths) and `pub(crate)` otherwise, so
/// the production Rust surface reflects only the napi-only contract.
macro_rules! test_visible_modules {
    ($($name:ident),+ $(,)?) => {
        $(
            #[cfg(feature = "test-support")]
            pub mod $name;
            #[cfg(not(feature = "test-support"))]
            pub(crate) mod $name;
        )+
    };
}
