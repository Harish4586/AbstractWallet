import hre from "hardhat";

async function main() {

  const { ethers } = await hre.network.connect(); 

  const [factoryOwner, paymasterOwner, targetOwner, entryPointOwner] = await ethers.getSigners();


  const EntryPoint = await ethers.getContractFactory("EntryPoint");
  const entryPoint = await EntryPoint.connect(entryPointOwner).deploy();
  await entryPoint.waitForDeployment();

  const entryPointAddress: any = await entryPoint.getAddress();

  console.log("EntryPoint:", entryPointAddress);

  const Factory = await ethers.getContractFactory("SmartAccountFactory");
  const factory = await Factory.connect(factoryOwner).deploy(entryPointAddress);
  await factory.waitForDeployment();
  console.log("factory:", await factory.getAddress());


  const PayMaster = await ethers.getContractFactory("Paymaster");
  const paymaster = await PayMaster.connect(paymasterOwner).deploy(entryPointAddress);
  await paymaster.waitForDeployment();

  console.log("PayMaster:", await paymaster.getAddress());

  const Target = await ethers.getContractFactory("Target");
  const target = await Target.connect(targetOwner).deploy();
  await target.waitForDeployment();

  console.log("Target:", await target.getAddress());
}

main();