import { expect } from "chai";
import hre from "hardhat";
const { ethers } = await hre.network.connect();

describe("ERC-4337 Integration Test", function () {
  let entryPoint: any, factory: any, paymaster: any, target: any;
  let owner1: any, owner2: any, bundler: any;

  beforeEach(async () => {
    [owner1, owner2, bundler] = await ethers.getSigners();


    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();

    const Factory = await ethers.getContractFactory("SmartAccountFactory");
    factory = await Factory.deploy(entryPoint.target);

    const Paymaster = await ethers.getContractFactory("Paymaster");
    paymaster = await Paymaster.deploy(entryPoint.target);

    await paymaster.deposit({ value: ethers.parseEther("1") });

    const Target = await ethers.getContractFactory("Target");
    target = await Target.deploy();


  });

  async function getUserOpHash(op: any) {
    const batchHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint256[]", "bytes[]"],
        [op.targets, op.values, op.datas]
      )
    );

    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        [
          "address",
          "bytes",
          "uint256",
          "address",
          "uint256",
          "bytes",
          "bytes32",
          "uint256",
          "uint256",
          "address",
        ],
        [
          op.sender,
          op.initCode,
          op.nonce,
          op.target,
          op.value,
          op.data,
          batchHash,
          op.callGasLimit,
          op.maxFeePerGas,
          op.paymaster,
        ]
      )
    );


  }

  async function signUserOp(hash: any, signer: any) {
    return await signer.signMessage(ethers.getBytes(hash));
  }

  it("should deploy account via initCode and execute tx", async () => {
    const owners = [owner1.address, owner2.address];
    const threshold = 2;
    const salt = 123;

    const predicted = await factory.PredictAddress(
      owners,
      threshold,
      salt
    );

    const initCode = ethers.concat([
      factory.target,
      factory.interface.encodeFunctionData("createAccount", [
        owners,
        threshold,
        salt,
      ]),
    ]);

    const op = {
      sender: predicted,
      initCode,
      nonce: 0,
      target: target.target,
      value: 0,
      data: target.interface.encodeFunctionData("setNumber", [7]),
      targets: [],
      values: [],
      datas: [],
      callGasLimit: 1_000_000,
      maxFeePerGas: 1,
      paymaster: ethers.ZeroAddress,
      signature: "0x",
    };

    const hash = await getUserOpHash(op);

    const sig1 = await signUserOp(hash, owner1);
    const sig2 = await signUserOp(hash, owner2);

    op.signature = ethers.concat([sig1, sig2]);

    await entryPoint.connect(bundler).handleOps([op]);

    expect(await target.number()).to.equal(7);

  });

  it("should execute batch transaction", async () => {
    const owners = [owner1.address, owner2.address];
    const threshold = 2;
    const salt = 456;
    const predicted = await factory.PredictAddress(
      owners,
      threshold,
      salt
    );

    const initCode = ethers.concat([
      factory.target,
      factory.interface.encodeFunctionData("createAccount", [
        owners,
        threshold,
        salt,
      ]),
    ]);

    const op = {
      sender: predicted,
      initCode,
      nonce: 0,
      target: ethers.ZeroAddress,
      value: 0,
      data: "0x",
      targets: [target.target, target.target],
      values: [0, 0],
      datas: [
        target.interface.encodeFunctionData("setNumber", [1]),
        target.interface.encodeFunctionData("setNumber", [2]),
      ],
      callGasLimit: 1_000_000,
      maxFeePerGas: 1,
      paymaster: ethers.ZeroAddress,
      signature: "0x",
    };

    const hash = await getUserOpHash(op);

    const sig1 = await signUserOp(hash, owner1);
    const sig2 = await signUserOp(hash, owner2);

    op.signature = ethers.concat([sig1, sig2]);

    await entryPoint.connect(bundler).handleOps([op]);

    expect(await target.number()).to.equal(2);

  });

  it("should use paymaster and reduce limit", async () => {
    const owners = [owner1.address, owner2.address];
    const threshold = 2;
    const salt = 789;

    const predicted = await factory.PredictAddress(
      owners,
      threshold,
      salt
    );

    await paymaster.approveUser(predicted, ethers.parseEther("1"));

    const initCode = ethers.concat([
      factory.target,
      factory.interface.encodeFunctionData("createAccount", [
        owners,
        threshold,
        salt,
      ]),
    ]);

    const op = {
      sender: predicted,
      initCode,
      nonce: 0,
      target: target.target,
      value: 0,
      data: target.interface.encodeFunctionData("setNumber", [9]),
      targets: [],
      values: [],
      datas: [],
      callGasLimit: 1_000_000,
      maxFeePerGas: 1,
      paymaster: paymaster.target,
      signature: "0x",
    };

    const hash = await getUserOpHash(op);

    const sig1 = await signUserOp(hash, owner1);
    const sig2 = await signUserOp(hash, owner2);

    op.signature = ethers.concat([sig1, sig2]);

    await entryPoint.connect(bundler).handleOps([op]);

    expect(await target.number()).to.equal(9);

    const remaining = await paymaster.userLimit(predicted);
    expect(remaining).to.be.lessThan(ethers.parseEther("1"));

  });

  it("should fail with wrong nonce", async () => {
    const owners = [owner1.address, owner2.address];
    const threshold = 2;
    const salt = 111;

    const predicted = await factory.PredictAddress(
      owners,
      threshold,
      salt
    );

    const initCode = ethers.concat([
      factory.target,
      factory.interface.encodeFunctionData("createAccount", [
        owners,
        threshold,
        salt,
      ]),
    ]);

    const op = {
      sender: predicted,
      initCode,
      nonce: 5, // WRONG nonce
      target: target.target,
      value: 0,
      data: target.interface.encodeFunctionData("setNumber", [3]),
      targets: [],
      values: [],
      datas: [],
      callGasLimit: 1_000_000,
      maxFeePerGas: 1,
      paymaster: ethers.ZeroAddress,
      signature: "0x",
    };

    const hash = await getUserOpHash(op);

    const sig1 = await signUserOp(hash, owner1);
    const sig2 = await signUserOp(hash, owner2);

    op.signature = ethers.concat([sig1, sig2]);

    await expect(
      entryPoint.connect(bundler).handleOps([op])
    ).to.be.revertedWith("signature is being replayed");


  });
});
