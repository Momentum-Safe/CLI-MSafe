script {
    use aptos_framework::coin;

    fun main<T>(s: &signer, to: address, amount: u64) {
        coin::transfer<T>(s, to, amount);
    }
}