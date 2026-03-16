# 🔐 ERC-4337 Account Abstraction — Custom Implementation

> A ground-up implementation of Account Abstraction inspired by [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337), built with Hardhat + Solidity + TypeScript. Supports multi-sig smart accounts, a paymaster for gas sponsorship, batch execution, and a simulated mempool bundler.

---

## 📐 ERC-4337 Alignment

| ERC-4337 Concept | This Implementation | Notes |
|---|---|---|
| `UserOperation` struct | ✅ `UserOp.sol` | Matches core fields; extends with `targets[]`, `values[]`, `datas[]` for batch |
| `EntryPoint` contract | ✅ `EntryPoint.sol` | Single entry for validation + execution |
| `SmartAccount` (sender) | ✅ `SmartAccount.sol` | Multi-sig, nonce replay protection |
| `Paymaster` | ✅ `Paymaster.sol` | Per-user gas limits, deposit-based sponsorship |
| `Bundler` | ✅ `bundler.ts` | Off-chain script; simulates + submits ops |
| Alt mempool | ✅ `mempool.ts` | File-based JSON mempool (local simulation) |
| Account factory | ✅ `SmartAccountFactory.sol` | CREATE2 deterministic deployment |
| `initCode` deployment | ✅ Supported | Factory is called inside `handleOps` if account not yet deployed |

> ⚠️ **Differences from canonical ERC-4337:** This is a simplified, educational implementation. It does not use a staked/trusted `EntryPoint` on mainnet, does not implement `aggregators`, and the mempool is file-based rather than a P2P network.

---

## 🗂️ Project Structure

```
contracts/
├── EntryPoint.sol          # Core orchestrator — validates & executes UserOps
├── SmartAccount.sol        # Multi-sig wallet (threshold signatures)
├── SmartAccountFactory.sol # CREATE2 factory for deterministic deployment
├── Paymaster.sol           # Gas sponsor — approves users & covers fees
├── Target.sol              # Demo contract (setNumber)
└── UserOp.sol              # UserOperation struct definition

scripts/
├── deploy.ts               # Deploys all contracts
├── userOpCreator.ts        # Builds, signs, and submits a UserOp to mempool
├── bundler.ts              # Polls mempool, simulates, and submits bundles
└── mempool.ts              # File-based mempool (mempool.json)
```

---

## 🔄 Full Flow Diagram

```
  [owner1 + owner2]
       │
       │  sign UserOpHash (multi-sig)
       ▼
 ┌─────────────────┐
 │  userOpCreator  │  ──── builds UserOperation struct
 │   (client)      │  ──── appends to mempool.json
 └─────────────────┘
          │
          │  (every 5 seconds)
          ▼
 ┌─────────────────┐
 │    bundler.ts   │  ──── reads mempool.json
 │   (off-chain)   │  ──── staticCall simulates each op
 └────────┬────────┘  ──── submits valid ops to EntryPoint
          │
          │  handleOps(ops[])
          ▼
 ┌─────────────────────────────────────────────────┐
 │                  EntryPoint.sol                 │
 │                                                 │
 │  1. Deploy SmartAccount (if initCode present)   │
 │  2. validateUserOp()  ◄── SmartAccount          │
 │  3. validatePaymasterUserOp() ◄── Paymaster     │
 │  4. executeUserOp()                             │
 │     └── executeBatch() or execute()             │
 │  5. Deduct gas from Paymaster deposit           │
 │  6. Pay bundler                                 │
 └─────────────────────────────────────────────────┘
          │
          ▼
 ┌─────────────────┐
 │   Target.sol    │  ◄── setNumber(42), setNumber(233)
 │  (demo contract)│
 └─────────────────┘
```

---

## 🧩 Component Deep Dives

### UserOperation Struct (`UserOp.sol`)

```
┌────────────────────────────────────────┐
│           UserOperation                │
├────────────────┬───────────────────────┤
│ sender         │ SmartAccount address  │
│ initCode       │ factory + calldata    │  ← only on first tx
│ nonce          │ replay protection     │
│ target         │ single call target    │  ← single exec
│ value          │ ETH to send           │
│ data           │ calldata              │
│ targets[]      │ batch targets         │  ← batch exec
│ values[]       │ batch ETH amounts     │
│ datas[]        │ batch calldatas       │
│ callGasLimit   │ max gas for execution │
│ maxFeePerGas   │ gas price             │
│ paymaster      │ sponsor address       │
│ signature      │ owner sigs (concat)   │
└────────────────┴───────────────────────┘
```

---

### Multi-Sig Validation (`SmartAccount.sol`)

```
  signature bytes (N × 65 bytes)
  ┌──────────┬──────────┬─────────┐
  │  sig[0]  │  sig[1]  │  ...    │
  │  65 bytes│  65 bytes│         │
  └────┬─────┴────┬─────┴─────────┘
       │          │
   recover()  recover()         ← ecrecover via ECDSA
       │          │
   isOwner?   isOwner?
       │          │
       └────┬─────┘
       validSigCount >= threshold?  ✅ / ❌
```

> Threshold is set at account creation. Both `owner1` and `owner2` must sign for a 2-of-2 wallet.

---

### Paymaster Gas Flow (`Paymaster.sol`)

```
  paymasterOwner
       │
       ├── approveUser(smartAccount, gasLimit)   ← whitelist + cap
       └── deposit(1000 ETH)  ──►  EntryPoint.deposits[paymaster]

  On execution:
       EntryPoint
         ├── checks userLimit[sender] >= estimatedGas
         ├── deducts gasCost from deposits[paymaster]
         ├── calls reduceUserLimit(sender, gasCost)
         └── sends gasCost ──► bundler (msg.sender)
```

---

### Account Deployment via `initCode`

```
  If SmartAccount NOT deployed yet:
  ┌──────────────────────────────────────────────────┐
  │  initCode = factoryAddress + createAccount(...)  │
  │                                                  │
  │  EntryPoint splits:                              │
  │    factory  = initCode[:20]                      │
  │    calldata = initCode[20:]                      │
  │    factory.call(calldata)   ──► SmartAccount     │
  │                                (CREATE2)         │
  └──────────────────────────────────────────────────┘

  Address is deterministic — predictable before deployment:
  PredictAddress(owners, threshold, salt)  ──► same address always
```

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Deploy contracts

```bash
npx hardhat run scripts/deploy.ts --network <network>
```

Update the deployed addresses in `userOpCreator.ts` and `bundler.ts`.

### 3. Start the bundler

```bash
npx hardhat run scripts/bundler.ts --network <network>
```

The bundler polls `mempool.json` every **5 seconds**.

### 4. Submit a UserOp

In a separate terminal:

```bash
npx hardhat run scripts/userOpCreator.ts --network <network>
```

This builds, signs, and drops a UserOp into the mempool. The bundler picks it up automatically.

---

## 🔢 Execution Sequence (End-to-End)

```
1.  deploy.ts runs
      └── EntryPoint, Factory, Paymaster, Target deployed

2.  userOpCreator.ts runs
      ├── Predicts SmartAccount address (CREATE2)
      ├── Builds UserOp with batch: setNumber(42), setNumber(233)
      ├── Hashes UserOp  →  userOpHash
      ├── owner1.sign(userOpHash)  +  owner2.sign(userOpHash)
      ├── signature = concat(sig1, sig2)
      └── mempool.add(userOp)  →  mempool.json

3.  bundler.ts (running in background)
      ├── reads mempool.json  →  finds 1 op
      ├── staticCall(handleOps([op]))  →  simulation passes ✅
      ├── entryPoint.handleOps([op])
      │     ├── deploy SmartAccount via initCode  (first time only)
      │     ├── validateUserOp  →  2-of-2 sigs verified ✅
      │     ├── validatePaymasterUserOp  →  limit ok ✅
      │     ├── executeBatch  →  setNumber(42), setNumber(233)
      │     ├── deduct gas from paymaster deposit
      │     └── pay bundler
      └── mempool.remove(op)

4.  Target.number()  →  233  ✅
```

---

## ⚙️ Key Design Decisions

**Why file-based mempool?**
Keeps the setup self-contained for local development. In production ERC-4337, bundlers subscribe to a P2P alt-mempool network.

**Why static simulation before bundling?**
Bundlers must not submit ops that will revert (they'd waste gas and not get paid). `staticCall` on `handleOps` lets the bundler filter bad ops before sending a real transaction.

**Why concat signatures instead of a mapping?**
Simplicity. The contract splits the bytes into 65-byte chunks, recovers each signer, and counts valid owners. No ordering guarantees needed.

**Why `nonce++` only inside `execute` / `executeBatch`?**
The nonce is incremented at execution time (inside `onlyEntryPoint` functions), not at validation time. This matches the ERC-4337 pattern where `validateUserOp` is a `view` and state changes happen only during execution.

---

## 📋 Contract Addresses (Example — update after deploy)

| Contract | Address |
|---|---|
| EntryPoint | `0x057ef64E23666F000b34aE31332854aCBd1c8544` |
| SmartAccountFactory | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Paymaster | `0x8464135c8F25Da09e49BC8782676a84730C318bC` |
| Target | `0x663F3ad617193148711d28f5334eE4Ed07016602` |

---

## 📚 Further Reading

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [eth-infinitism/account-abstraction](https://github.com/eth-infinitism/account-abstraction) — canonical reference implementation
- [ERC-4337 Explained — Alchemy](https://www.alchemy.com/blog/account-abstraction)