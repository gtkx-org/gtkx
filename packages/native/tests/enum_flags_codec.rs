use native::ffi::codec::{Encoder as _, EnumFlagsCodec, EnumFlagsKind, IntegerCodec};
use test_support as helpers;

fn orientation_codec() -> EnumFlagsCodec {
    EnumFlagsCodec {
        kind: EnumFlagsKind::Enum,
        shared_library: "libgtk-4.so.1".to_owned(),
        get_type_fn_name: "gtk_orientation_get_type".to_owned(),
        storage: IntegerCodec::I32,
        mask: None,
    }
}

#[test]
fn encode_rejects_invalid_enum_value_synchronously() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let err = orientation_codec()
            .encode(
                &env,
                helpers::napi_mock::to_unknown(&env, helpers::napi_mock::fake_double(999.0)),
            )
            .expect_err("an invalid enum member must fail to encode");
        assert!(err.to_string().contains("not a valid member"));
    });
}

#[test]
fn encode_accepts_valid_enum_value() {
    helpers::run(|| {
        let env = helpers::fake_env();
        assert!(
            orientation_codec()
                .encode(
                    &env,
                    helpers::napi_mock::to_unknown(&env, helpers::napi_mock::fake_double(0.0))
                )
                .is_ok()
        );
    });
}
