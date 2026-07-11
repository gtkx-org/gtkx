use napi::sys;

#[test]
fn mock_intercepts_and_round_trips_napi_calls() {
    test_support::run(|| {
        let env = test_support::fake_env();

        let mut created: sys::napi_value = std::ptr::null_mut();
        let status = unsafe { sys::napi_create_double(env.raw(), 3.5, &mut created) };
        assert_eq!(status, sys::Status::napi_ok);
        assert!(!created.is_null());

        let mut back = 0.0;
        unsafe { sys::napi_get_value_double(env.raw(), created, &mut back) };
        assert_eq!(back, 3.5);

        let mut kind: sys::napi_valuetype = -1;
        unsafe { sys::napi_typeof(env.raw(), created, &mut kind) };
        assert_eq!(kind, sys::ValueType::napi_number);

        assert!(test_support::napi_mock::count("napi_create_double") >= 1);
        assert!(test_support::napi_mock::count("napi_get_value_double") >= 1);
    });
}
