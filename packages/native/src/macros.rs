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
