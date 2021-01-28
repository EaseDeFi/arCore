import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase } from "../utils";
let step = BigNumber.from("86400");
function getBucket(expire: BigNumber) : BigNumber {
  return (expire.div(step)).mul(step);
}
describe("BalanceExpireTracker", function(){
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
    describe("when everything is empty", function(){
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

    describe("when there is something", function(){
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
            await tracker.add(head.expiresAt.sub(step));
          });

          it("should store expire metadata", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            expect(metadata.next).to.be.equal(headId);
            expect(metadata.prev).to.be.equal(0);
            expect(metadata.expiresAt).to.be.equal(head.expiresAt.sub(step));
          });

          it("should set head to new id", async function(){
            const id = await tracker.lastId();
            const head = await tracker.head();
            expect(id).to.be.equal(head);
          });

          it("should set bucket head and tail to new id", async function(){
            const id = await tracker.lastId();
            const bucket = await tracker.checkPoints(getBucket(head.expiresAt.sub(step)));
            console.log(bucket);
            console.log(head.expiresAt.toString());
            expect(bucket.head).to.be.equal(id);
            expect(bucket.tail).to.be.equal(id);
          });
          it("should be connected", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            const metadata_next = await tracker.infos(metadata.next);
            expect(metadata_next.prev).to.be.equal(id);
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
          it("should be connected", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            const metadata_next = await tracker.infos(metadata.next);
            expect(metadata_next.prev).to.be.equal(id);
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
          it("should be connected", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            const metadata_prev = await tracker.infos(metadata.prev);
            expect(metadata_prev.next).to.be.equal(id);
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
          it("should be connected", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            const metadata_prev = await tracker.infos(metadata.prev);
            expect(metadata_prev.next).to.be.equal(id);
          });
        });
      });
      describe("when new expire is in between", async function(){
        beforeEach(async function(){
          await tracker.add(now);
          await tracker.add(now.add(100));
          for(let i = 1;i<10; i++) {
            await tracker.add(now.add(step).add(100*i));
          }
          await tracker.add(now.add(step).add(1000));
          await tracker.add(now.add(step.mul(4)).add(1000));
        });
        describe("when bucket is empty", function(){
          beforeEach(async function(){
            await tracker.add(now.add(step.mul(3)).add(1));
          });

          it("should store expire metadata", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            expect(metadata.next).to.be.equal(id.sub(1));
            expect(metadata.prev).to.be.equal(id.sub(2));
            expect(metadata.expiresAt).to.be.equal(now.add(step.mul(3)).add(1));
          });

          it("should connect prev and next", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            const metadata_next = await tracker.infos(metadata.next);
            const metadata_prev = await tracker.infos(metadata.prev);
            expect(metadata_next.prev).to.be.equal(id);
            expect(metadata_prev.next).to.be.equal(id);
          });

          it("should set bucket head and tail to new id", async function(){
            const id = await tracker.lastId();
            const bucket = await tracker.checkPoints(getBucket(now.add(step.mul(3)).add(1)));
            expect(bucket.head).to.be.equal(id);
            expect(bucket.tail).to.be.equal(id);
          });
          it("should be connected", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            const metadata_next = await tracker.infos(metadata.next);
            const metadata_prev = await tracker.infos(metadata.prev);
            expect(metadata_next.prev).to.be.equal(id);
            expect(metadata_prev.next).to.be.equal(id);
          });
        });
        describe("when bucket is not empty", function(){
          beforeEach(async function(){
            await tracker.add(now.add(step.add(501)));
          });

          it("should store expire metadata", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            const metadata_next = await tracker.infos(metadata.next);
            const metadata_prev = await tracker.infos(metadata.prev);
            expect(metadata_next.expiresAt).to.be.gte(metadata.expiresAt);
            expect(metadata_prev.expiresAt).to.be.lte(metadata.expiresAt);
          });
          it("should be connected", async function(){
            const id = await tracker.lastId();
            const metadata = await tracker.infos(id);
            const metadata_next = await tracker.infos(metadata.next);
            const metadata_prev = await tracker.infos(metadata.prev);
            expect(metadata_next.prev).to.be.equal(id);
            expect(metadata_prev.next).to.be.equal(id);
          });

          describe("when new expire is head of bucket", async function(){
            let bucket_metadata;
            beforeEach(async function(){
              bucket_metadata = await tracker.checkPoints(getBucket(now.add(step)));
              await tracker.add(now.add(step));
            });
            it("should set bucket tail to new id", async function(){
              const id = await tracker.lastId();
              const bucket = await tracker.checkPoints(getBucket(now.add(step)));
              expect(bucket.head).to.be.equal(id);
              expect(bucket.tail).to.be.equal(bucket_metadata.tail);
            });
            it("should be connected", async function(){
              const id = await tracker.lastId();
              const metadata = await tracker.infos(id);
              const metadata_next = await tracker.infos(metadata.next);
              const metadata_prev = await tracker.infos(metadata.prev);
              expect(metadata_next.prev).to.be.equal(id);
              expect(metadata_prev.next).to.be.equal(id);
            });
          });

          describe("when new expire is tail of bucket", async function(){
            let bucket_metadata;
            beforeEach(async function(){
              bucket_metadata = await tracker.checkPoints(getBucket(now.add(step)));
              await tracker.add(now.add(step.mul(2).sub(1000)));
            });
            it("should set bucket tail to new id", async function(){
              const id = await tracker.lastId();
              const bucket = await tracker.checkPoints(getBucket(now.add(step.mul(2).sub(1000))));
              expect(bucket.head).to.be.equal(bucket_metadata.head);
              expect(bucket.tail).to.be.equal(id);
            });
            it("should be connected", async function(){
              const id = await tracker.lastId();
              const metadata = await tracker.infos(id);
              const metadata_next = await tracker.infos(metadata.next);
              const metadata_prev = await tracker.infos(metadata.prev);
              expect(metadata_next.prev).to.be.equal(id);
              expect(metadata_prev.next).to.be.equal(id);
            });
          });
        });
      });
    });
  });

  describe("#pop()", function(){
    describe("when there is only one element", function(){
      beforeEach(async function(){
        await tracker.add(now);
        const id = await tracker.lastId();
        await tracker.remove(id);
      });
      it("should delete head", async function(){
        const head = await tracker.head();
        expect(head).to.be.equal(0);
      });
      it("should delete tail", async function(){
        const tail = await tracker.tail();
        expect(tail).to.be.equal(0);
      });
      it("should delete bucket", async function(){
        const bucket = await tracker.checkPoints(getBucket(now));
        expect(bucket.head).to.be.equal(0);
        expect(bucket.tail).to.be.equal(0);
      });
    });

    describe("when there is two elements", function(){
      beforeEach(async function(){
        await tracker.add(now);
        await tracker.add(now.add(1000));
        const id = await tracker.lastId();
        await tracker.remove(id);
      });
      it("should set left element's next == prev == 0", async function(){
        const id = (await tracker.lastId()).sub(1);
        const metadata = await tracker.infos(id);
        expect(metadata.prev).to.be.equal(0);
        expect(metadata.next).to.be.equal(0);
      });
      it("should set head == tail", async function(){
        const id = (await tracker.lastId()).sub(1);
        const head = await tracker.head();
        const tail = await tracker.tail();
        expect(id).to.be.equal(head);
        expect(tail).to.be.equal(id);
      });
      it("should set bucket.head == bucket.tail", async function(){
        const id = (await tracker.lastId()).sub(1);
        const metadata = await tracker.infos(id);
        const bucket = await tracker.checkPoints(getBucket(metadata.expiresAt));
        expect(bucket.head).to.be.equal(id);
        expect(bucket.tail).to.be.equal(id);
      });
    });

    describe("when there is more than 2 elements", function(){
      beforeEach(async function(){
        await tracker.add(now);
        await tracker.add(now.add(100));
        for(let i = 1;i<10; i++) {
          await tracker.add(now.add(step).add(100*i));
        }
        await tracker.add(now.add(step).add(1000));
        await tracker.add(now.add(step.mul(2)).add(100));
        await tracker.add(now.add(step.mul(2)).add(200));
        await tracker.add(now.add(step.mul(3)).add(100));
        await tracker.add(now.add(step.mul(4)).add(1000));
      });

      describe("when deleting element is head", function(){
        let metadata_old;
        let bucket_old;
        beforeEach(async function(){
          const id = await tracker.head();
          metadata_old = await tracker.infos(id);
          bucket_old = await tracker.checkPoints(getBucket(metadata_old.expiresAt));
          await tracker.remove(id);
        });

        it("should move head to next", async function(){
          const new_head = await tracker.head();
          expect(new_head).to.be.equal(metadata_old.next);
        });
        it("should delete prev of new head", async function(){
          const new_head = await tracker.head();
          const new_head_info = await tracker.infos(new_head);
          expect(new_head_info.prev).to.be.equal(0);
        });
      });
      describe("when deleting element is tail", function(){
        let metadata_old;
        let bucket_old;
        beforeEach(async function(){
          const id = await tracker.tail();
          metadata_old = await tracker.infos(id);
          bucket_old = await tracker.checkPoints(getBucket(metadata_old.expiresAt));
          await tracker.remove(id);
        });

        it("should move tail to prev", async function(){
          const new_tail = await tracker.tail();
          expect(new_tail).to.be.equal(metadata_old.prev);
        });
        it("should delete next of new tail", async function(){
          const new_head = await tracker.head();
          const new_head_info = await tracker.infos(new_head);
          expect(new_head_info.prev).to.be.equal(0);
        });
      });
      describe("when deleting element is in-between", function(){
        describe("when bucket had only one element", function(){
          let metadata_old;
          let bucket_old;
          beforeEach(async function(){
            const id = (await tracker.tail()).sub(1);
            metadata_old = await tracker.infos(id);
            bucket_old = await tracker.checkPoints(getBucket(metadata_old.expiresAt));
            await tracker.remove(id);
          });
          it("should delete bucket", async function(){
            const bucket = await tracker.checkPoints(getBucket(metadata_old.expiresAt));
            expect(bucket.head).to.be.equal(0);
            expect(bucket.tail).to.be.equal(0);
          });
          it("should be connected", async function(){
            const prev_info = await tracker.infos(metadata_old.prev);
            const next_info = await tracker.infos(metadata_old.next);
            expect(prev_info.next).to.be.equal(metadata_old.next);
            expect(next_info.prev).to.be.equal(metadata_old.prev);
          });
        });
        describe("when bucket had two elements", function(){
          let metadata_old;
          let bucket_old;
          beforeEach(async function(){
            const id = (await tracker.tail()).sub(2);
            metadata_old = await tracker.infos(id);
            bucket_old = await tracker.checkPoints(getBucket(metadata_old.expiresAt));
            await tracker.remove(id);
          });
          it("should set bucket's head == tail", async function(){
            const bucket = await tracker.checkPoints(getBucket(metadata_old.expiresAt));
            expect(bucket.head).to.be.equal(bucket.tail);
            expect(bucket.tail).to.be.not.equal(0);
          });
          it("should be connected", async function(){
            const prev_info = await tracker.infos(metadata_old.prev);
            const next_info = await tracker.infos(metadata_old.next);
            expect(prev_info.next).to.be.equal(metadata_old.next);
            expect(next_info.prev).to.be.equal(metadata_old.prev);
          });
        });
        describe("when bucket had more than 2 elements", function(){
          let metadata_old;
          let bucket_old;
          beforeEach(async function(){
            const id = (await tracker.tail()).sub(6);
            metadata_old = await tracker.infos(id);
            bucket_old = await tracker.checkPoints(getBucket(metadata_old.expiresAt));
            await tracker.remove(id);
          });
          it("should be connected", async function(){
            const prev_info = await tracker.infos(metadata_old.prev);
            const next_info = await tracker.infos(metadata_old.next);
            expect(prev_info.next).to.be.equal(metadata_old.next);
            expect(next_info.prev).to.be.equal(metadata_old.prev);
          });
        });
      });
    });
  });
});
