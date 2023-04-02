export type OperationData = {
    fnName: string,
    typeArgs: string[],
    args: string[]
}

const SET_X_OPERATION_DATA: OperationData = {
    fnName: "set_x",
    typeArgs: [],
    args: []
}

const SET_Y_OPERATION_DATA: OperationData = {
    fnName: "set_y",
    typeArgs: [],
    args: []
}

export const AdminOperationData = {
    SETX: SET_X_OPERATION_DATA,
    SETY: SET_Y_OPERATION_DATA
};
