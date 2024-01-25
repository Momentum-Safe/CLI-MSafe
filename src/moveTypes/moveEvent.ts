import {AptosClient, Types} from "aptos";

export type GUID = {
    id: ID
};

/// A non-privileged identifier that can be freely created by anyone. Useful for looking up GUID's.
export type ID = {
    /// If creation_num is `i`, this is the `i+1`th GUID created by `addr`
    creation_num: Types.U64,
    /// Address that created the GUID
    addr: Types.Address
};

export type EventHandle<T> = {
    /// Total number of events emitted to this event stream.
    counter: Types.U64,
    /// A globally unique ID for this event stream.
    guid: GUID,
};
export type AnyNumber = bigint | number;
export type PaginationArgs = {
    start?: AnyNumber;
    limit?: number;
}

export type Event<T> = Omit<Types.VersionedEvent, 'data'> & {data: T};


