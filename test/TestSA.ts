import { expect } from "chai";
import hre from "hardhat";
const { ethers } = await hre.network.connect();

describe("SmartAccount - Full Test Suite", function () {
  let smartAccount: any;
  let owners: any[];
  let entryPoint: any;
  let nonOwner: any;
  let target: any;

  const threshold = 2;

  beforeEach(async () => {
    const signers = await ethers.getSigners();

    owners = [signers[0], signers[1], signers[2]];
    entryPoint = signers[3];
    nonOwner = signers[4];

    const Target = await ethers.getContractFactory("Target");
    target = await Target.deploy();
    await target.waitForDeployment();

    const SmartAccount = await ethers.getContractFactory("SmartAccount");
    smartAccount = await SmartAccount.deploy(
      owners.map(o => o.address),
      threshold,
      entryPoint.address
    );

    await smartAccount.waitForDeployment();
  });



  async function sign(hash: string, signer: any) {
    return await signer.signMessage(ethers.getBytes(hash));
  }

  function pack(sigs: string[]) {
    return "0x" + sigs.map(s => s.slice(2)).join("");
  }

  async function getValidSignatures(nonce: bigint) {
    const userOpHash = ethers.keccak256(
      ethers.solidityPacked(["uint256"], [nonce])
    );

    const sig1 = await sign(userOpHash, owners[0]);
    const sig2 = await sign(userOpHash, owners[1]);

    return {
      userOpHash,
      signatures: pack([sig1, sig2])
    };
  }



  it("should deploy correctly", async () => {
    expect(await smartAccount.threshold()).to.equal(threshold);
    expect(await smartAccount.nonce()).to.equal(0);
  });

  it("should set owners correctly", async () => {
    for (let i = 0; i < owners.length; i++) {
      expect(await smartAccount.isOwner(owners[i].address)).to.equal(true);
    }
  });



  it("should validate correct signatures", async () => {
    const nonce = await smartAccount.nonce();

    const { userOpHash, signatures } = await getValidSignatures(nonce);

    expect(
      await smartAccount.validateUserOp(userOpHash, signatures, nonce)
    ).to.equal(true);
  });

  it("should fail if signatures < threshold", async () => {
    const nonce = await smartAccount.nonce();

    const userOpHash = ethers.keccak256(
      ethers.solidityPacked(["uint256"], [nonce])
    );

    const sig = await sign(userOpHash, owners[0]);

    await expect(
      smartAccount.validateUserOp(userOpHash, pack([sig]), nonce)
    ).to.be.revertedWith("not enough signatures");
  });

  it("should prevent replay attack using nonce", async () => {
    const nonce = await smartAccount.nonce();

    const { userOpHash, signatures } = await getValidSignatures(nonce);

    await smartAccount.connect(entryPoint).execute(
      target.target,
      0,
      "0x"
    );

    await expect(
      smartAccount.validateUserOp(userOpHash, signatures, nonce)
    ).to.be.revertedWith("signature is being replayed");
  });



  it("should execute transaction", async () => {
    const data = target.interface.encodeFunctionData("setNumber", [42]);

    await smartAccount
      .connect(entryPoint)
      .execute(target.target, 0, data);

    expect(await target.number()).to.equal(42);
  });

  it("should restrict execute to entryPoint", async () => {
    const data = target.interface.encodeFunctionData("setNumber", [1]);

    await expect(
      smartAccount.connect(owners[0]).execute(
        target.target,
        0,
        data
      )
    ).to.be.revertedWith("not entrypoint");
  });



  it("should execute batch transactions", async () => {
    const data1 = target.interface.encodeFunctionData("setNumber", [10]);
    const data2 = target.interface.encodeFunctionData("setNumber", [20]);

    await smartAccount.connect(entryPoint).executeBatch(
      [target.target, target.target],
      [0, 0],
      [data1, data2]
    );

    expect(await target.number()).to.equal(20);
  });

  it("should revert on empty batch", async () => {
    await expect(
      smartAccount.connect(entryPoint).executeBatch([], [], [])
    ).to.be.revertedWith("empty batch");
  });



  it("should receive ETH", async () => {
    await owners[0].sendTransaction({
      to: smartAccount.target,
      value: ethers.parseEther("1")
    });

    const balance = await ethers.provider.getBalance(
      smartAccount.target
    );

    expect(balance).to.equal(ethers.parseEther("1"));
  });

  it("should send ETH via execute", async () => {
    await owners[0].sendTransaction({
      to: smartAccount.target,
      value: ethers.parseEther("1")
    });

    const before = await ethers.provider.getBalance(nonOwner.address);

    await smartAccount.connect(entryPoint).execute(
      nonOwner.address,
      ethers.parseEther("0.5"),
      "0x"
    );

    const after = await ethers.provider.getBalance(nonOwner.address);

    expect(after > before).to.equal(true);
  });
});