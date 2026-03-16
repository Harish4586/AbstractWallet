import hre from "hardhat";
import { mempool } from "./mempool.js";

async function main() {

  const { ethers } = await hre.network.connect();

  // same destructuring order as old script
  const [
    factoryOwner,
    paymasterOwner,
    targetOwner,
    entryPointOwner,
    owner1,
    owner2,
    bundler
  ] = await ethers.getSigners();

  const factoryAddress =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const targetAddress =
    "0x663F3ad617193148711d28f5334eE4Ed07016602";

  const paymasterAddress =
    "0x8464135c8F25Da09e49BC8782676a84730C318bC";

  const factory = await ethers.getContractAt(
    "SmartAccountFactory",
    factoryAddress
  );

  const paymaster = await ethers.getContractAt(
    "Paymaster",
    paymasterAddress
  );

  const owners = [owner1.address, owner2.address];
  const threshold = 2;

  const smartAccountAddress =
    await factory.PredictAddress(owners, threshold, 1);

  let initCode: any = "0x";
  let nonce: any = 0;
  let smartAccount: any;

  const code = await ethers.provider.getCode(smartAccountAddress);

  if (code === "0x") {
    console.log("smart account is not deployed yet!!! deployinggg.....");

    const factoryCalldata =
      factory.interface.encodeFunctionData(
        "createAccount",
        [owners, threshold, 1]
      );

    initCode = factoryAddress + factoryCalldata.slice(2);

  } else {
    console.log("smart account already deployed");
    console.log("smartAccountAddress", smartAccountAddress);

    smartAccount = await ethers.getContractAt(
      "SmartAccount",
      smartAccountAddress
    );

    nonce = await smartAccount.nonce();
  }

  const target = await ethers.getContractAt(
    "Target",
    targetAddress
  );

  // approveUser first, then deposit — same order as old script
  const gasLimitApproved =
    (BigInt(1_000_000) * (ethers.parseUnits("800", "gwei")));

  await paymaster
    .connect(paymasterOwner)
    .approveUser(smartAccountAddress, gasLimitApproved);

  await paymaster
    .connect(paymasterOwner)
    .deposit({ value: ethers.parseEther("1000") });

  const calldata1 = target.interface.encodeFunctionData(
    "setNumber",
    [42]
  );

  const calldata2 = target.interface.encodeFunctionData(
    "setNumber",
    [233]
  );

  const userOp: any = {

    sender: smartAccountAddress,
    initCode,
    nonce,

    target: ethers.ZeroAddress,
    value: 0,
    data: "0x",

    targets: [targetAddress, targetAddress],
    values: [0, 0],
    datas: [calldata1, calldata2],

    callGasLimit: 1_000_000,
    maxFeePerGas: ethers.parseUnits("20", "gwei"),

    paymaster: paymasterAddress,
    signature: "0x"
  };

  // batchHash over actual targets/values/datas — same as old script
  const batchHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address[]", "uint256[]", "bytes[]"],
      [userOp.targets, userOp.values, userOp.datas]
    )
  );

  const userOpHash = ethers.keccak256(
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
        "address"
      ],
      [
        userOp.sender,
        userOp.initCode,
        userOp.nonce,

        userOp.target,
        userOp.value,
        userOp.data,
        batchHash,

        userOp.callGasLimit,
        userOp.maxFeePerGas,
        userOp.paymaster
      ]
    )
  );

  const sig1 = await owner1.signMessage(
    ethers.getBytes(userOpHash)
  );

  const sig2 = await owner2.signMessage(
    ethers.getBytes(userOpHash)
  );

  userOp.signature = ethers.concat([sig1, sig2]);

  mempool.add(
    JSON.parse(
      JSON.stringify(
        userOp,
        (k, v) => typeof v === "bigint" ? v.toString() : v
      )
    )
  );

  console.log("UserOp created and added to mempool");
  const num = await target.number();
console.log("Target number before bundling:", num.toString());
}

main();