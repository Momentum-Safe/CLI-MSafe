import {Types} from "aptos";

export type Table<K,V> = {
    handle: string
}

export type TableWithLength<K,V> = {
    inner: Table<K, V>,
    length: string,
}

export type Element<K, V> = {
    key: K,
    value: V
}
// key of simple map in response data is always string
export type SimpleMap<K extends string, V> = {
    data: Element<K, V>[]
}

export type TEd25519PublicKey = Types.Ed25519Signature['public_key']
export type TEd25519Signature = Types.Ed25519Signature['signature']

export type Vector<T> = T[]
