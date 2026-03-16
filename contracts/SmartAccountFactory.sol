// // SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./SmartAccount.sol";

contract SmartAccountFactory {
    address public entryPoint;

    event AccountCreated(address account, address owner);

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }

    function createAccount(
        address[] memory owners,
        uint256 threshold,
        uint256 salt
    ) public returns (address account) {
        account = PredictAddress(owners, threshold, salt);

        if (account.code.length > 0) {
            return account;
        }

        account = address(
            new SmartAccount{salt: bytes32(salt)}(owners, threshold, entryPoint)
        );

        emit AccountCreated(account, owners[0]);
    }

    function PredictAddress(
        address[] memory owners,
        uint256 threshold,
        uint256 salt
    ) public view returns (address predicted) {
        bytes memory bytecode = abi.encodePacked(
            type(SmartAccount).creationCode,
            abi.encode(owners, threshold, entryPoint)
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                bytes32(salt),
                keccak256(bytecode)
            )
        );

        predicted = address(uint160(uint256(hash)));
    }
}
