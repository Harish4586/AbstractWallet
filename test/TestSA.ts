import { expect } from "chai";
import { describe } from "mocha";
import hre from "hardhat";
const { ethers } = await hre.network.connect();

describe("SmartAccount", function () {

  let smartAccount: any;
  let owner: any;
  let user: any;
  let target: any;
  let calldata: any;

  beforeEach(async function () {

    const { ethers } = await hre.network.connect();

    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];

    const SmartAccount = await ethers.getContractFactory("SmartAccount");

    smartAccount = await SmartAccount.deploy(owner.address);
    await smartAccount.waitForDeployment();

    const Target = await ethers.getContractFactory("Target");

    target = await Target.deploy();
    await target.waitForDeployment();

    calldata = target.interface.encodeFunctionData(
      "setNumber",
      [42]
    );

  });

  it("should set correct owner", async function () {

    const contractOwner = await smartAccount.owner();

    expect(contractOwner).to.equal(owner.address);

  });

  it("should execute transaction with valid signature", async function () {

    const { ethers } = await hre.network.connect();

    const value = 0;

    const nonce = await smartAccount.nonce();

    const hash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "bytes", "uint256"],
        [
          await smartAccount.getAddress(),
          await target.getAddress(),
          value,
          calldata,
          nonce
        ]
      )
    );

    const signature = await owner.signMessage(
      ethers.getBytes(hash)
    );

    await smartAccount
      .connect(user)
      .executeWithSig(
        await target.getAddress(),
        value,
        calldata,
        signature
      );

    const num = await target.number();

    expect(num).to.equal(42);

  });

  it("should increment nonce", async function () {

    const { ethers } = await hre.network.connect();

    const value = 0;

    const nonce = await smartAccount.nonce();

    const hash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "bytes", "uint256"],
        [
          await smartAccount.getAddress(),
          await target.getAddress(),
          value,
          calldata,
          nonce
        ]
      )
    );

    const signature = await owner.signMessage(
      ethers.getBytes(hash)
    );

    await smartAccount.executeWithSig(
      await target.getAddress(),
      value,
      calldata,
      signature
    );

    const newNonce = await smartAccount.nonce();

    expect(newNonce).to.equal(1);

  });

  it("should revert for invalid signature", async function () {

    const { ethers } = await hre.network.connect();

    const value = await ethers.parseEther("10");

    const nonce = await smartAccount.nonce();

    const hash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "bytes", "uint256"],
        [
          await smartAccount.getAddress(),
          await target.getAddress(),
          value,
          calldata,
          nonce
        ]
      )
    );

    const wrongSignature = await user.signMessage(
      ethers.getBytes(hash)
    );

    await expect(
      smartAccount.executeWithSig(
        await target.getAddress(),
        value,
        calldata,
        wrongSignature
      )
    ).to.be.revertedWith("Invalid signature");

  }); it("should call setNumber", async function () {



    const data = calldata;
    const value = 0;

    const nonce = await smartAccount.nonce();

    const hash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "bytes", "uint256"],
        [
          await smartAccount.getAddress(),
          await target.getAddress(),
          value,
          data,
          nonce
        ]
      )
    );

    const signature = await owner.signMessage(
      ethers.getBytes(hash)
    );


    await smartAccount.connect(user).executeWithSig(
      await target.getAddress(),
      value,
      data,
      signature
    );


    const num = await target.number();



    expect(num).to.equal(42);


  });

});