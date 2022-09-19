module msafe::test_coin {
    struct MoonCoin {}

    fun init_module(sender: &signer) {
        aptos_framework::managed_coin::initialize<MoonCoin>(
            sender,
            b"Test Coin",
            b"TEST",
            6,
            false,
        );
    }
}