module msafe::test_coin {
    struct TestCoin {}

    fun init_module(sender: &signer) {
        aptos_framework::managed_coin::initialize<TestCoin>(
            sender,
            b"Test Coin",
            b"TEST",
            6,
            false,
        );
    }
}