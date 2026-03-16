// //SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

pragma solidity ^0.8.20;

contract SmartAccount is ReentrancyGuard {
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public threshold;
    address public entryPoint;
    uint256 public nonce;
    using ECDSA for bytes32;
    event Executed(address target, uint256 value, bytes data);

    constructor(
        address[] memory _owners,
        uint256 _threshold,
        address _entryPoint
    ) {
        require(_owners.length >= _threshold, "threshold > owners");

        entryPoint = _entryPoint;
        threshold = _threshold;

        for (uint i = 0; i < _owners.length; i++) {
            require(!isOwner[_owners[i]], "duplicate owner");

            isOwner[_owners[i]] = true;
            owners.push(_owners[i]);
        }
    }

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "not entrypoint");
        _;
    }

    function validateUserOp(
        bytes32 userOpHash,
        bytes calldata signatures,
        uint256 _nonce
    ) external view returns (bool) {
        require(nonce == _nonce, "signature is being replayed"); //changed here
        bytes32 ethSigned = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash)
        );

        uint256 sigCount = signatures.length / 65;

        require(sigCount >= threshold, "not enough signatures");

        uint256 validSig;

        for (uint256 i = 0; i < sigCount; i++) {
            bytes memory sig = signatures[i * 65:(i + 1) * 65];

            address signer = ethSigned.recover(sig);

            if (isOwner[signer]) {
                validSig++;
            }
        }

        return validSig >= threshold;
    }

    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyEntryPoint {
        nonce++;

        (bool success, ) = target.call{value: value}(data);

        require(success, "tx failed");

        emit Executed(target, value, data);
    }

    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyEntryPoint {
        require(targets.length > 0, "empty batch");

        require(
            targets.length == values.length && values.length == datas.length,
            "array mismatch"
        );

        nonce++;

        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(datas[i]);

            require(success, "call failed");
        }
    }

    receive() external payable {}
}
