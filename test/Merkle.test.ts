import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

function randomBytes32(length: number) : Uint8Array[] {
  let arrays = new Array<Uint8Array>();
  for(let i = 0 ; i < length ; i++){
    let bytes32 = ethers.utils.randomBytes(32);
    arrays.push(bytes32);
  }
  return arrays;
}

class OrderedMerkleTree {
  leaves: Uint8Array[];
  constructor(list: Uint8Array[]) {
    this.leaves = list;
  }
  
  calculateRoot() : Uint8Array {
    let layer = this.leaves;
    const abiCoder = new ethers.utils.AbiCoder();
    while(layer.length > 1){
      let nextLayer = new Array<Uint8Array>();;
      for(let i = 0; i < layer.length; i+=2){
        let left = layer[i];
        let right = i == layer.length-1? layer[i] : layer[i+1];
        if(ethers.BigNumber.from(left).gt(ethers.BigNumber.from(right))){
          // if left > right => swap
          let temp = left;
          left = right;
          right = temp;
        }
        let elem = ethers.utils.keccak256(abiCoder.encode(["bytes32", "bytes32"],[left,right]));
        nextLayer.push(ethers.utils.arrayify(elem));
      }
      layer = nextLayer;
    }
    return layer[0];
  }

  getPath(index: number) : Uint8Array[] {
    let path = new Array<Uint8Array>();
    let layer = this.leaves;
    let target = this.leaves[index];
    const abiCoder = new ethers.utils.AbiCoder();
    while(layer.length > 1){
      let nextLayer = new Array<Uint8Array>();;
      for(let i = 0; i < layer.length; i+=2){
        let left = layer[i];
        let right = i == layer.length-1? layer[i] : layer[i+1];
        if(ethers.BigNumber.from(left).gt(ethers.BigNumber.from(right))){
          // if left > right => swap
          let temp = left;
          left = right;
          right = temp;
        }
        let elem = ethers.utils.keccak256(abiCoder.encode(["bytes32", "bytes32"],[left,right]));
        nextLayer.push(ethers.utils.arrayify(elem));
        if(ethers.BigNumber.from(left).eq(ethers.BigNumber.from(target))){
          path.push(right);
          target = ethers.utils.arrayify(elem);
        } else if(ethers.BigNumber.from(right).eq(ethers.BigNumber.from(target))){
          path.push(left);
          target = ethers.utils.arrayify(elem);
        }
      }
      layer = nextLayer;
    }
    return path;
  }

  verify(path: Uint8Array[], leaf: Uint8Array) : boolean {
    const abiCoder = new ethers.utils.AbiCoder();
    let hash = leaf;
    for(let i = 0; i<path.length; i++){
      let left: Uint8Array;
      let right: Uint8Array;
      if(ethers.BigNumber.from(hash).gt(ethers.BigNumber.from(path[i]))){
        left = path[i];
        right = hash;
      } else {
        left = hash;
        right = path[i];
      }
      hash = ethers.utils.arrayify(ethers.utils.keccak256(abiCoder.encode(["bytes32","bytes32"],[left, right])));
    }
    return ethers.utils.hexlify(hash) == ethers.utils.hexlify(this.calculateRoot());
  }
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
