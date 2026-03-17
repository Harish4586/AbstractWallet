//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./UserOp.sol";

interface IEntryPoint {
    function depositTo(address account) external payable;
}

contract Paymaster {
    address public owner;
    address public entryPoint;

    mapping(address => bool) public approvedUsers;
    mapping(address => uint256) public userLimit;

    constructor(address _entryPoint) {
        owner = msg.sender;
        entryPoint = _entryPoint;
    }

    modifier onlyOwner() {
        require(msg.sender == owner,"Non-Owner");
        _;
    }

    function approveUser(address user, uint256 spendLimit) external onlyOwner {
        approvedUsers[user] = true; 
        userLimit[user] = spendLimit;
    }

    function validatePaymasterUserOp(
        UserOperation calldata op,
        uint256 estimatedGasCost
    ) external view returns (bool) {
        require(msg.sender == entryPoint, "only entrypoint");
        require(userLimit[op.sender] >= estimatedGasCost);

        return approvedUsers[op.sender];
    }

    function reduceUserLimit(address user, uint256 gasCost) external {
        require(msg.sender == entryPoint);

        userLimit[user] -= gasCost;
    }

    function deposit() external payable {
        IEntryPoint(entryPoint).depositTo{value: msg.value}(address(this));
    }

    receive() external payable {}
}
