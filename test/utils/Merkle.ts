import { ethers } from "hardhat";
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

export { OrderedMerkleTree };
