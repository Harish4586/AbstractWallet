import { expect } from "chai";
import hre from "hardhat";
const { ethers } = await hre.network.connect();

describe("EntryPoint - Full Flow", function () {
  let entryPoint: any;
  let smartAccount: any;
  let paymaster: any;
  let target: any;

  let owners: any[];
  let bundler: any;

  const threshold = 2;

  beforeEach(async () => {
    const signers = await ethers.getSigners();

    owners = [signers[0], signers[1], signers[2]];
    bundler = signers[3];

    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();

    const SmartAccount = await ethers.getContractFactory("SmartAccount");
    smartAccount = await SmartAccount.deploy(
      owners.map(o => o.address),
      threshold,
      entryPoint.target
    );
    await smartAccount.waitForDeployment();

    const Paymaster = await ethers.getContractFactory("Paymaster");
    paymaster = await Paymaster.deploy(entryPoint.target);
    await paymaster.waitForDeployment();

    const Target = await ethers.getContractFactory("Target");
    target = await Target.deploy();
    await target.waitForDeployment();


    await owners[0].sendTransaction({
      to: smartAccount.target,
      value: ethers.parseEther("1"),
    });

    await paymaster.deposit({ value: ethers.parseEther("1") });
  });



  async function signUserOp(hash: string) {
    const sig1 = await owners[0].signMessage(ethers.getBytes(hash));
    const sig2 = await owners[1].signMessage(ethers.getBytes(hash));

    return "0x" + sig1.slice(2) + sig2.slice(2);
  }

  async function buildUserOp({
    useBatch = false,
    usePaymaster = false,
  }: any) {
    const nonce = await smartAccount.nonce();

    let targets: string[] = [];
    let values: bigint[] = [];
    let datas: string[] = [];

    let targetAddr = target.target;
    let data = target.interface.encodeFunctionData("setNumber", [42]);

    if (useBatch) {
      targets = [target.target, target.target];
      values = [0n, 0n];
      datas = [
        target.interface.encodeFunctionData("setNumber", [10]),
        target.interface.encodeFunctionData("setNumber", [20]),
      ];
    }

    const op: any = {
      sender: smartAccount.target,
      initCode: "0x",
      nonce,
      target: useBatch ? ethers.ZeroAddress : targetAddr,
      value: 0,
      data: useBatch ? "0x" : data,
      targets,
      values,
      datas,
      callGasLimit: 1_000_000,
      maxFeePerGas: ethers.parseUnits("1", "gwei"),
      paymaster: usePaymaster ? paymaster.target : ethers.ZeroAddress,
      signature: "0x",
    };

    const hash = await entryPoint.getUserOpHash(op);
    op.signature = await signUserOp(hash);

    return { op, hash };
  }



  it("should execute single transaction via handleOps", async () => {
    const { op } = await buildUserOp({});

    await entryPoint.connect(bundler).handleOps([op]);

    expect(await target.number()).to.equal(42);
  });

  it("should execute batch transaction", async () => {
    const { op } = await buildUserOp({ useBatch: true });

    await entryPoint.connect(bundler).handleOps([op]);

    expect(await target.number()).to.equal(20);
  });



  it("should execute using paymaster", async () => {
    await paymaster.approveUser(
      smartAccount.target,
      ethers.parseEther("1")
    );

    const { op } = await buildUserOp({ usePaymaster: true });

    await entryPoint.connect(bundler).handleOps([op]);

    expect(await target.number()).to.equal(42);
  });


  it("should fail with invalid signature", async () => {
    const { op, hash } = await buildUserOp({});

    const fakeSig = await bundler.signMessage(ethers.getBytes(hash));


    op.signature = "0x" + fakeSig.slice(2) + fakeSig.slice(2);

    await expect(
      entryPoint.connect(bundler).handleOps([op])
    ).to.be.revertedWith("Invalid signature");
  });


  it("should prevent replay attack", async () => {
    const { op } = await buildUserOp({});

    await entryPoint.connect(bundler).handleOps([op]);

    await expect(
      entryPoint.connect(bundler).handleOps([op])
    ).to.be.revertedWith("signature is being replayed");
  });


  it("should fail if paymaster has low balance", async () => {
    const Paymaster = await ethers.getContractFactory("Paymaster");

    const emptyPaymaster = await Paymaster.deploy(entryPoint.target);
    await emptyPaymaster.waitForDeployment();

    await emptyPaymaster.approveUser(
      smartAccount.target,
      ethers.parseEther("1")
    );

    const nonce = await smartAccount.nonce();

    const op: any = {
      sender: smartAccount.target,
      initCode: "0x",
      nonce,
      target: target.target,
      value: 0,
      data: target.interface.encodeFunctionData("setNumber", [1]),
      targets: [],
      values: [],
      datas: [],
      callGasLimit: 1_000_000,
      maxFeePerGas: ethers.parseUnits("1", "gwei"),
      paymaster: emptyPaymaster.target,
      signature: "0x",
    };

    const hash = await entryPoint.getUserOpHash(op);
    op.signature = await signUserOp(hash);

    await expect(
      entryPoint.connect(bundler).handleOps([op])
    ).to.be.revertedWith("paymaster balance low");
  });



  it("should emit UserOperationEvent", async () => {
    const { op } = await buildUserOp({});

    await expect(entryPoint.connect(bundler).handleOps([op]))
      .to.emit(entryPoint, "UserOperationEvent")
      .withArgs(smartAccount.target, true);
  });
});