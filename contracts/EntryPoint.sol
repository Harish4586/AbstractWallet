// // // SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./UserOp.sol";

interface ISmartAccount {
    function validateUserOp(
        bytes32 userOpHash,
        bytes calldata signatures,
        uint256 _nonce
    ) external view returns (bool);

    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external;

    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external;
}

interface IPaymaster {
    function validatePaymasterUserOp(
        UserOperation calldata op,
        uint256 gasLimit
    ) external view returns (bool);

    function reduceUserLimit(address user, uint256 gasCost) external;
}

contract EntryPoint {
    event UserOperationEvent(address sender, bool success);

    mapping(address => uint256) public deposits;

    function depositTo(address account) external payable {
        deposits[account] += msg.value;
    }

    function handleOps(UserOperation[] calldata ops) external {
        for (uint i = 0; i < ops.length; i++) {
            UserOperation calldata op = ops[i];

            uint256 gasStart = gasleft();

            if (op.sender.code.length == 0) {
                require(op.initCode.length > 0, "account not deployed");

                address factory = address(bytes20(op.initCode));

                bytes memory factoryCalldata = op.initCode[20:];

                (bool success, ) = factory.call(factoryCalldata);

                require(success, "wallet deployment failed");
            }

            bytes32 userOpHash = getUserOpHash(op);

            bool valid = ISmartAccount(op.sender).validateUserOp(
                userOpHash,
                op.signature,
                op.nonce
            );

            require(valid, "Invalid signature");

            if (op.paymaster != address(0)) {
                uint256 estimatedGas = op.callGasLimit * op.maxFeePerGas;

                bool paymasterValid = IPaymaster(op.paymaster)
                    .validatePaymasterUserOp(op, estimatedGas);

                require(paymasterValid, "Paymaster rejected");
            }

            bool successExec = false;

            try this.executeUserOp(op) {
                successExec = true;
            } catch {
                successExec = false;
            }

            uint256 gasUsed = gasStart - gasleft();
            uint256 gasCost = gasUsed * op.maxFeePerGas;

            if (op.paymaster != address(0)) {
                require(
                    deposits[op.paymaster] >= gasCost,
                    "paymaster balance low"
                );

                deposits[op.paymaster] -= gasCost;

                IPaymaster(op.paymaster).reduceUserLimit(op.sender, gasCost);

                (bool successPay, ) = payable(msg.sender).call{value: gasCost}(
                    ""
                );

                require(successPay, "bundler payment failed");
            }

            emit UserOperationEvent(op.sender, successExec);
        }
    }

    function executeUserOp(UserOperation calldata op) external {
        require(msg.sender == address(this));

        if (op.targets.length > 0) {
            ISmartAccount(op.sender).executeBatch(
                op.targets,
                op.values,
                op.datas
            );
        } else {
            ISmartAccount(op.sender).execute(op.target, op.value, op.data);
        }
    }

    function getUserOpHash(
        UserOperation calldata op
    ) public pure returns (bytes32) {
        bytes32 batchHash = keccak256(
            abi.encode(op.targets, op.values, op.datas)
        );

        return
            keccak256(
                abi.encode(
                    op.sender,
                    op.initCode,
                    op.nonce,
                    op.target,
                    op.value,
                    op.data,
                    batchHash,
                    op.callGasLimit,
                    op.maxFeePerGas,
                    op.paymaster
                )
            );
    }
}
