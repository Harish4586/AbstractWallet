

import hre from "hardhat";

async function main() {

  const { ethers } = await hre.network.connect();

  const [
    factoryOwner,
    paymasterOwner,
    targetOwner,
    entryPointOwner,

    owner1,
    owner2,
    bundler

  ] = await ethers.getSigners();


  const owners = [owner1.address, owner2.address];
  const threshold = 2;

  const entryPointAddress = "0xCE3478A9E0167a6Bc5716DC39DbbbfAc38F27623";
  const factoryAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const paymasterAddress = "0x05Aa229Aec102f78CE0E852A812a388F076Aa555";
  const targetAddress = "0x8438Ad1C834623CfF278AB6829a248E37C2D7E3f";

  const entryPoint = await ethers.getContractAt(
    "EntryPoint",
    entryPointAddress
  );

  const factory = await ethers.getContractAt(
    "SmartAccountFactory",
    factoryAddress
  );


  const smartAccountAddress =
    await factory.PredictAddress(owners, threshold, 1);

  let initCode: any = "0x";
  let nonce: any = 0;
  let smartAccount: any;

  const code = await ethers.provider.getCode(smartAccountAddress);

  if (code == "0x") {

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

    smartAccount =
      await ethers.getContractAt(
        "SmartAccount",
        smartAccountAddress
      );

    nonce = await smartAccount.nonce();
  }

  const target = await ethers.getContractAt(
    "Target",
    targetAddress
  );

  const paymaster = await ethers.getContractAt(
    "Paymaster",
    paymasterAddress
  ); 

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
    [23]
  );

  const userOp = {

    sender: smartAccountAddress,
    initCode: initCode,
    nonce: nonce,

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

  // concatenate signatures
  userOp.signature = ethers.concat([sig1, sig2]);

  const bundlerBalanceBefore =
    await ethers.provider.getBalance(bundler.address);

  console.log(
    "Bundler balance before:",
    ethers.formatEther(bundlerBalanceBefore),
    "ETH"
  );

  const tx = await entryPoint
    .connect(bundler)
    .handleOps([userOp]);

  await tx.wait();

  const bundlerBalanceAfter =
    await ethers.provider.getBalance(bundler.address);

  console.log(
    "Bundler balance after:",
    ethers.formatEther(bundlerBalanceAfter),
    "ETH"
  );

  console.log("UserOperation executed");

  const num = await target.number();

  console.log("Target number:", num.toString());
}

main();