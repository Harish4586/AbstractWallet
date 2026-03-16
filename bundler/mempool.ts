import fs from "fs";
import path from "path";

const MEMPOOL_FILE = path.join(process.cwd(), "mempool.json");

export class UserOpMempool {

  constructor() {
    if (!fs.existsSync(MEMPOOL_FILE)) {
      fs.writeFileSync(MEMPOOL_FILE, JSON.stringify([], null, 2));
    }
  }

  getAll() {
    try {
      const data = fs.readFileSync(MEMPOOL_FILE, "utf8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  add(userOp: any) {

    const ops = this.getAll();

    ops.push(userOp);

    fs.writeFileSync(
      MEMPOOL_FILE,
      JSON.stringify(ops, null, 2)
    );

    console.log("UserOp added to mempool");
  }

  remove(userOp: any) {

    let ops = this.getAll();

    ops = ops.filter(
      (op: any) =>
        !(op.sender === userOp.sender && op.nonce === userOp.nonce)
    );

    fs.writeFileSync(
      MEMPOOL_FILE,
      JSON.stringify(ops, null, 2)
    ); 
  }
}

export const mempool = new UserOpMempool();