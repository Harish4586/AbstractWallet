// import hre from "hardhat";
// import { mempool } from "./mempool.js";

// async function main() {

//   const { ethers } = await hre.network.connect();

//   // destructure all 7 signers so bundler is at index [6] — same as old script
//   const [
//     factoryOwner,
//     paymasterOwner,
//     targetOwner,
//     entryPointOwner,
//     owner1,
//     owner2,
//     bundlerSigner
//   ] = await ethers.getSigners();

//   const entryPointAddress =
//     "0x057ef64E23666F000b34aE31332854aCBd1c8544";

//   const entryPoint = await ethers.getContractAt(
//     "EntryPoint",
//     entryPointAddress
//   );

//   console.log("Bundler started... watching mempool.json every 5 seconds");

//   setInterval(async () => {

//     const ops = mempool.getAll();

//     if (ops.length === 0) {
//       console.log("No UserOps in mempool");
//       return;
//     }

//     console.log(`Bundling ${ops.length} UserOps...`);

//     try {

//       const formattedOps = ops.map((op: any) => ({
//         sender: op.sender,
//         initCode: op.initCode,
//         nonce: BigInt(op.nonce),

//         target: op.target,
//         value: BigInt(op.value),
//         data: op.data,

//         targets: op.targets || [],
//         values: (op.values || []).map((v: any) => BigInt(v)),
//         datas: op.datas || [],

//         callGasLimit: BigInt(op.callGasLimit),
//         maxFeePerGas: BigInt(op.maxFeePerGas),

//         paymaster: op.paymaster,
//         signature: op.signature
//       }));

//       // bundlerSigner at index [6] matches old script's `bundler` signer
//       const tx = await entryPoint
//         .connect(bundlerSigner)
//         .handleOps(formattedOps);

//       console.log("Bundle TX:", tx.hash);

//       await tx.wait();

//       console.log("Bundle executed");

//       for (const op of ops) {
//         mempool.remove(op);
//       }
//       //here we check if tx was successfully executed or not
//       const target = await ethers.getContractAt("Target", "0x663F3ad617193148711d28f5334eE4Ed07016602");
//       const num = await target.number();
//       console.log("Target number after bundling:", num.toString());

//     } catch (err: any) {

//       console.log("Bundler error:", err?.reason || err?.message || err);

//     }

//   }, 5000);


// }

// main();











import hre from "hardhat";
import { mempool } from "./mempool.js";

async function main() {

  const { ethers } = await hre.network.connect();

  const [
    factoryOwner,
    paymasterOwner,
    targetOwner,
    entryPointOwner,
    owner1,
    owner2,
    bundlerSigner
  ] = await ethers.getSigners();

  const entryPointAddress =
    "0x057ef64E23666F000b34aE31332854aCBd1c8544";
  const targetAddress =
    "0x663F3ad617193148711d28f5334eE4Ed07016602";

  const entryPoint = await ethers.getContractAt(
    "EntryPoint",
    entryPointAddress
  );

  console.log("Bundler started... watching mempool.json every 5 seconds");

  setInterval(async () => {

    const ops = mempool.getAll();

    if (ops.length === 0) {
      console.log("No UserOps in mempool");
      return;
    }

    console.log(`Found ${ops.length} UserOp(s) in mempool. Simulating...`);

    // format all ops first
    const formattedOps = ops.map((op: any) => ({
      sender: op.sender,
      initCode: op.initCode,
      nonce: BigInt(op.nonce),

      target: op.target,
      value: BigInt(op.value),
      data: op.data,

      targets: op.targets || [],
      values: (op.values || []).map((v: any) => BigInt(v)),
      datas: op.datas || [],

      callGasLimit: BigInt(op.callGasLimit),
      maxFeePerGas: BigInt(op.maxFeePerGas),

      paymaster: op.paymaster,
      signature: op.signature
    }));

    // simulate each op individually — filter out bad ones
    const validOps: any[] = [];
    const validRawOps: any[] = [];

    for (let i = 0; i < formattedOps.length; i++) {
      try {
        await entryPoint
          .connect(bundlerSigner)
          .handleOps.staticCall([formattedOps[i]]);

        validOps.push(formattedOps[i]);
        validRawOps.push(ops[i]);
        console.log(`  Op [${i}] sender=${ops[i].sender} nonce=${ops[i].nonce} — OK`);

      } catch (simErr: any) {
        const reason = simErr?.reason || simErr?.shortMessage || simErr?.message || "unknown";
        console.log(`  Op [${i}] sender=${ops[i].sender} nonce=${ops[i].nonce} — INVALID: ${reason}`);
      }
    }

    if (validOps.length === 0) {
      console.log("No valid ops to bundle.");
      return;
    }

    console.log(`Bundling ${validOps.length} valid op(s)...`);

    try {
      const balanceBefore = await ethers.provider.getBalance(bundlerSigner.address);
      console.log("Bundler balance before:", ethers.formatEther(balanceBefore), "ETH");

      const tx = await entryPoint
        .connect(bundlerSigner)
        .handleOps(validOps);

      console.log("Bundle TX:", tx.hash);

      await tx.wait();
      const balanceAfter = await ethers.provider.getBalance(bundlerSigner.address);
      console.log("Bundler balance after:", ethers.formatEther(balanceAfter), "ETH");

      // show exact difference
      const diff = balanceAfter - balanceBefore;
      console.log("Balance change:", ethers.formatEther(diff), "ETH");


      console.log("Bundle executed");


      const target = await ethers.getContractAt(
        "Target",
        targetAddress
      );

      const num = await target.number();
      console.log("Target number before bundling:", num.toString());


      for (const op of validRawOps) {
        mempool.remove(op);
      }

    } catch (err: any) {

      console.log("Bundler error:", err?.reason || err?.message || err);

    }

  }, 5000);
}

main();