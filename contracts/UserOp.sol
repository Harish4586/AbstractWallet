// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

struct UserOperation {
    address sender;
    bytes initCode;
    uint256 nonce;
    address target;
    uint256 value;
    bytes data;
    address[] targets;
    uint256[] values;
    bytes[] datas;
    uint256 callGasLimit;
    uint256 maxFeePerGas;
    address paymaster;
    bytes signature;
}
