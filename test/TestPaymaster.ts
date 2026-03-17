
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = await hre.network.connect();


describe("Paymaster - Unit Tests", function () {
  let paymaster: any;
  let entryPoint: any;

  let owner: any;
  let user: any;
  let other: any;

  beforeEach(async () => {
    [owner, user, other] = await ethers.getSigners();

    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();

    const Paymaster = await ethers.getContractFactory("Paymaster");
    paymaster = await Paymaster.deploy(entryPoint.target);
    await paymaster.waitForDeployment();
  });


  it("should approve user with spend limit", async () => {
    await paymaster.approveUser(user.address, 1000);

    expect(await paymaster.approvedUsers(user.address)).to.equal(true);
    expect(await paymaster.userLimit(user.address)).to.equal(1000);
  });

  it("should overwrite existing user limit", async () => {
    await paymaster.approveUser(user.address, 1000);
    await paymaster.approveUser(user.address, 5000);

    expect(await paymaster.userLimit(user.address)).to.equal(5000);
  });

  it("should not allow non-owner to approve user", async () => {
    await expect(
      paymaster.connect(other).approveUser(user.address, 1000)
    ).to.be.revertedWith("Non-Owner");
  });



  it("should revert if validatePaymasterUserOp is NOT called by entryPoint", async () => {
    const dummyOp = {
      sender: user.address,
      initCode: "0x",
      nonce: 0,
      target: ethers.ZeroAddress,
      value: 0,
      data: "0x",
      targets: [],
      values: [],
      datas: [],
      callGasLimit: 100000,
      maxFeePerGas: ethers.parseUnits("1", "gwei"),
      paymaster: paymaster.target,
      signature: "0x",
    };

    await expect(
      paymaster.validatePaymasterUserOp(dummyOp, 1000)
    ).to.be.revertedWith("only entrypoint");
  });



  it("should store correct limit for multiple users", async () => {
    await paymaster.approveUser(user.address, 1000);
    await paymaster.approveUser(other.address, 2000);

    expect(await paymaster.userLimit(user.address)).to.equal(1000);
    expect(await paymaster.userLimit(other.address)).to.equal(2000);
  });



  it("should deposit ETH to EntryPoint", async () => {
    const amount = ethers.parseEther("1");

    await paymaster.deposit({ value: amount });

    const balance = await ethers.provider.getBalance(entryPoint.target);

    expect(balance).to.equal(amount);
  });

  it("should accept direct ETH transfers", async () => {
    const amount = ethers.parseEther("0.5");

    await owner.sendTransaction({
      to: paymaster.target,
      value: amount,
    });

    const balance = await ethers.provider.getBalance(paymaster.target);

    expect(balance).to.equal(amount);
  });


  it("should set correct owner", async () => {
    expect(await paymaster.owner()).to.equal(owner.address);
  });
});