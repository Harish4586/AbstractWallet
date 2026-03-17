import { expect } from "chai";
import hre from "hardhat";
const { ethers } = await hre.network.connect();

describe("SmartAccountFactory", function () {
  let factory: any;
  let entryPoint: any;
  let owners: any[];

  const threshold = 2;
  const salt = 12345;

  beforeEach(async () => {
    const signers = await ethers.getSigners();

    owners = [signers[0], signers[1], signers[2]];
    entryPoint = signers[3];

    const Factory = await ethers.getContractFactory("SmartAccountFactory");
    factory = await Factory.deploy(entryPoint.address);

    await factory.waitForDeployment();
  });



  it("should predict correct CREATE2 address", async () => {
    const predicted = await factory.PredictAddress(
      owners.map(o => o.address),
      threshold,
      salt
    );

    const tx = await factory.createAccount(
      owners.map(o => o.address),
      threshold,
      salt
    );

    const receipt = await tx.wait();


    const event = receipt.logs.find((log: any) => {
      try {
        return factory.interface.parseLog(log).name === "AccountCreated";
      } catch {
        return false;
      }
    });

    const parsed = factory.interface.parseLog(event);
    const deployedAddress = parsed.args.account;

    expect(deployedAddress).to.equal(predicted);
  });



  it("should deploy smart account", async () => {
    const addr = await factory.createAccount(
      owners.map(o => o.address),
      threshold,
      salt
    );

    const predicted = await factory.PredictAddress(
      owners.map(o => o.address),
      threshold,
      salt
    );

    const code = await ethers.provider.getCode(predicted);

    expect(code).to.not.equal("0x");
  });

  it("should not redeploy if already exists", async () => {
    const predicted = await factory.PredictAddress(
      owners.map(o => o.address),
      threshold,
      salt
    );


    await factory.createAccount(
      owners.map(o => o.address),
      threshold,
      salt
    );


    const returned = await factory.createAccount.staticCall(
      owners.map(o => o.address),
      threshold,
      salt
    );

    expect(returned).to.equal(predicted);
  });



  it("should emit AccountCreated event", async () => {
    await expect(
      factory.createAccount(
        owners.map(o => o.address),
        threshold,
        salt
      )
    )
      .to.emit(factory, "AccountCreated")
      .withArgs(
        await factory.PredictAddress(
          owners.map(o => o.address),
          threshold,
          salt
        ),
        owners[0].address
      );
  });



  it("deployed account should have correct config", async () => {
    const predicted = await factory.PredictAddress(
      owners.map(o => o.address),
      threshold,
      salt
    );

    await factory.createAccount(
      owners.map(o => o.address),
      threshold,
      salt
    );

    const smartAccount = await ethers.getContractAt(
      "SmartAccount",
      predicted
    );

    expect(await smartAccount.threshold()).to.equal(threshold);
    expect(await smartAccount.entryPoint()).to.equal(entryPoint.address);

    for (let i = 0; i < owners.length; i++) {
      expect(await smartAccount.isOwner(owners[i].address)).to.equal(true);
    }
  });



  it("same inputs should always give same address", async () => {
    const addr1 = await factory.PredictAddress(
      owners.map(o => o.address),
      threshold,
      salt
    );

    const addr2 = await factory.PredictAddress(
      owners.map(o => o.address),
      threshold,
      salt
    );

    expect(addr1).to.equal(addr2);
  });

  it("different salt should give different address", async () => {
    const addr1 = await factory.PredictAddress(
      owners.map(o => o.address),
      threshold,
      salt
    );

    const addr2 = await factory.PredictAddress(
      owners.map(o => o.address),
      threshold,
      salt + 1
    );

    expect(addr1).to.not.equal(addr2);
  });

  it("different owners should give different address", async () => {
    const signers = await ethers.getSigners();

    const newOwners = [signers[4], signers[5]];

    const addr1 = await factory.PredictAddress(
      owners.map(o => o.address),
      threshold,
      salt
    );

    const addr2 = await factory.PredictAddress(
      newOwners.map(o => o.address),
      threshold,
      salt
    );

    expect(addr1).to.not.equal(addr2);
  });
});