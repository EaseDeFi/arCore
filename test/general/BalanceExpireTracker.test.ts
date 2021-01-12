import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase } from "../utils";
let step = BigNumber.from("86400");
function getBucket(expire: BigNumber) : BigNumber {
  return (expire.div(step)).mul(step);
}
describe.only("BalanceExpireTracker", function(){
  let tracker: Contract;
  let now: BigNumber;

  beforeEach(async function(){
    const Tracker = await ethers.getContractFactory("BalanceExpireTrackerMock");
    tracker = await Tracker.deploy();
    const realTime = await getTimestamp();
    await increase(getBucket(realTime).add(step).sub(realTime).toNumber());
    now = await getTimestamp();
  });

  describe("#push()", function(){
    describe("when everything is empty", async function(){
      beforeEach(async function(){
        await tracker.add(now);
      });

      it("should store expire metadata", async function(){
        const id = await tracker.lastId();
        const metadata = await tracker.infos(id);
        expect(metadata.next).to.be.equal(0);
        expect(metadata.prev).to.be.equal(0);
        expect(metadata.expiresAt).to.be.equal(now);
      });

      it("should set head to new id", async function(){
        const id = await tracker.lastId();
        const head = await tracker.head();
        expect(id).to.be.equal(head);
      });
      
      it("should set tail to new id", async function(){
        const id = await tracker.lastId();
        const tail = await tracker.tail();
        expect(id).to.be.equal(tail);
      });

      it("should set bucket head and tail to new id", async function(){
        const id = await tracker.lastId();
        const bucket = await tracker.checkPoints(getBucket(now));
        expect(bucket.head).to.be.equal(id);
        expect(bucket.tail).to.be.equal(id);
      });
    });

    describe("when there is something", async function(){
      describe("when new expire is prior to head", async function(){
        describe("when bucket is empty", function(){
          let head: any;
          let tail: any;
          let headId: BigNumber;
          let tailId: BigNumber;
          beforeEach(async function(){
            // this will add to the front of the bucket
            await tracker.add(now);
            head = await tracker.infos(await tracker.head());
            headId = await tracker.head();
            tail = await tracker.infos(await tracker.tail());
            tailId = await tracker.tail();
            // this will add to the last of the empty bucket
            await tracker.add(head.expiresAt.sub(1));
          });

          it("should store expire metadata", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            expect(metadata.next).to.be.equal(headId);
            expect(metadata.prev).to.be.equal(0);
            expect(metadata.expiresAt).to.be.equal(head.expiresAt.sub(1));
          });

          it("should set head to new id", async function(){
            const id = await tracker.lastId();
            const head = await tracker.head();
            expect(id).to.be.equal(head);
          });

          it("should set bucket head and tail to new id", async function(){
            const id = await tracker.lastId();
            const bucket = await tracker.checkPoints(getBucket(now.sub(1)));
            expect(bucket.head).to.be.equal(id);
            expect(bucket.tail).to.be.equal(id);
          });
        });
        describe("when bucket is not empty", function(){
          let head: any;
          let tail: any;
          let headId: BigNumber;
          let tailId: BigNumber;
          beforeEach(async function(){
            // this will add to the front of the bucket
            await tracker.add(now.add(1));
            head = await tracker.infos(await tracker.head());
            headId = await tracker.head();
            tail = await tracker.infos(await tracker.tail());
            tailId = await tracker.tail();
            // this will add to the front of the bucket
            await tracker.add(head.expiresAt.sub(1));
          });

          it("should store expire metadata", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            expect(metadata.next).to.be.equal(headId);
            expect(metadata.prev).to.be.equal(0);
            expect(metadata.expiresAt).to.be.equal(head.expiresAt.sub(1));
          });

          it("should set head to new id", async function(){
            const id = await tracker.lastId();
            const head = await tracker.head();
            expect(id).to.be.equal(head);
          });

          it("should set bucket head and tail to new id", async function(){
            const id = await tracker.lastId();
            const bucket = await tracker.checkPoints(getBucket(now));
            expect(bucket.head).to.be.equal(id);
            expect(bucket.tail).to.be.equal(id.sub(1));
          });
        });
      });
      describe("when new expire is later than tail", async function(){
        describe("when bucket is empty", function(){
          let head: any;
          let tail: any;
          let headId: BigNumber;
          let tailId: BigNumber;
          beforeEach(async function(){
            // this will add to the front of the bucket
            await tracker.add(now);
            head = await tracker.infos(await tracker.head());
            headId = await tracker.head();
            tail = await tracker.infos(await tracker.tail());
            tailId = await tracker.tail();
            // this will add to the last of the empty bucket
            await tracker.add(tail.expiresAt.add(step));
          });

          it("should store expire metadata", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            expect(metadata.next).to.be.equal(0);
            expect(metadata.prev).to.be.equal(tailId);
            expect(metadata.expiresAt).to.be.equal(tail.expiresAt.add(step));
          });

          it("should set tail to new id", async function(){
            const id = await tracker.lastId();
            const tail = await tracker.tail();
            expect(id).to.be.equal(tail);
          });

          it("should set bucket head and tail to new id", async function(){
            const id = await tracker.lastId();
            const bucket = await tracker.checkPoints(getBucket(tail.expiresAt.add(step)));
            expect(bucket.head).to.be.equal(id);
            expect(bucket.tail).to.be.equal(id);
          });
        });
        describe("when bucket is not empty", function(){
          let head: any;
          let tail: any;
          let headId: BigNumber;
          let tailId: BigNumber;
          beforeEach(async function(){
            // this will add to the front of the bucket
            await tracker.add(now.add(1));
            head = await tracker.infos(await tracker.head());
            headId = await tracker.head();
            tail = await tracker.infos(await tracker.tail());
            tailId = await tracker.tail();
            // this will add to the front of the bucket
            await tracker.add(tail.expiresAt.add(step.sub(100)));
          });

          it("should store expire metadata", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            expect(metadata.next).to.be.equal(0);
            expect(metadata.prev).to.be.equal(tailId);
            expect(metadata.expiresAt).to.be.equal(tail.expiresAt.add(step.sub(100)));
          });

          it("should set tail to new id", async function(){
            const id = await tracker.lastId();
            const tail = await tracker.tail();
            expect(id).to.be.equal(tail);
          });

          it("should set bucket tail to new id", async function(){
            const id = await tracker.lastId();
            const bucket = await tracker.checkPoints(getBucket(tail.expiresAt));
            expect(bucket.head).to.be.equal(id.sub(1));
            expect(bucket.tail).to.be.equal(id);
          });
        });
      });
      describe("when new expire is in between", async function(){
        describe("when bucket is empty", function(){
          let head: any;
          let tail: any;
          let headId: BigNumber;
          let tailId: BigNumber;
          beforeEach(async function(){
          });

          it("should store expire metadata", async function(){
          });

          it("should connect prev and next", async function(){
          });

          it("should set bucket head and tail to new id", async function(){
          });
        });
        describe("when bucket is not empty", function(){
          let head: any;
          let tail: any;
          let headId: BigNumber;
          let tailId: BigNumber;
          beforeEach(async function(){
            // this will add to the front of the bucket
            await tracker.add(now.add(1));
            head = await tracker.infos(await tracker.head());
            headId = await tracker.head();
            tail = await tracker.infos(await tracker.tail());
            tailId = await tracker.tail();
            // this will add to the front of the bucket
            await tracker.add(tail.expiresAt.add(step.sub(100)));
          });

          it("should store expire metadata", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            expect(metadata.next).to.be.equal(0);
            expect(metadata.prev).to.be.equal(tailId);
            expect(metadata.expiresAt).to.be.equal(tail.expiresAt.add(step.sub(100)));
          });

          it("should set tail to new id", async function(){
            const id = await tracker.lastId();
            const tail = await tracker.tail();
            expect(id).to.be.equal(tail);
          });

          it("should set bucket tail to new id", async function(){
            const id = await tracker.lastId();
            const bucket = await tracker.checkPoints(getBucket(tail.expiresAt));
            expect(bucket.head).to.be.equal(id.sub(1));
            expect(bucket.tail).to.be.equal(id);
          });
        });
      });
    });
  });
});
