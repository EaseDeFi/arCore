import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { OrderedMerkleTree } from "./utils/Merkle";
function randomBytes32(length: number) : Uint8Array[] {
  let arrays = new Array<Uint8Array>();
  for(let i = 0 ; i < length ; i++){
    let bytes32 = ethers.utils.randomBytes(32);
    arrays.push(bytes32);
  }
  return arrays;
}


describe("MerkleProof", function () {
  let accounts: Signer[];
  let merkle: Contract;
  beforeEach(async function () {
    const MerkleFactory = await ethers.getContractFactory("MerkleProofMock");
    accounts = await ethers.getSigners();
    merkle = await MerkleFactory.deploy();
  });

  describe("#calculateRoot()", function () {
    it("should calculate correctly", async function (){
      const list = randomBytes32(10);
      const tree = new OrderedMerkleTree(list);
      expect(ethers.utils.hexlify(tree.calculateRoot())).to.equal(await merkle.calculateRoot(list));
    });

    it("should be able to calculate path", async function (){
      const list = randomBytes32(10);
      const tree = new OrderedMerkleTree(list);
      for(let i = 0; i<10; i++){
        const path = tree.getPath(i);
        expect(tree.verify(path, list[i])).to.equal(true);
      }
    });
  });

  describe('#verify()', function () {
    it("should be able to calculate path", async function (){
      const list = randomBytes32(10);
      const tree = new OrderedMerkleTree(list);
      const root = tree.calculateRoot();
      for(let i = 0; i<10; i++){
        const path = tree.getPath(i);
        expect(tree.verify(path, list[i])).to.equal(true);
        expect(await merkle.verify(path, root, list[i])).to.be.equal(true);
      }
    });
  });
});
