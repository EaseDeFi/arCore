import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { increase } from "../utils";
function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}

let buckets : Set<number>;
let resets : Set<number>;
let nodes : Array<string>;
let bucketElements : Map<number, Array<string>>;
let expiry : Map<string, number>;

const STAKE_MANAGER = "0x1337def1670c54b2a70e590b5654c2b7ce1141a2";
const ARMOR_MULTISIG = "0x1f28eD9D4792a567DaD779235c2b766Ab84D8E33";
function getBucket(expiry: BigNumber) : BigNumber {
  return (expiry.div(86400)).mul(86400);
}
describe.only("Hotfix test", function() {
  let accounts: Signer[];
  let stakeManager: Contract;
  let owner: Signer;
  
  before(async function(){
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ARMOR_MULTISIG]
    });
    owner = await ethers.provider.getSigner(ARMOR_MULTISIG);
    const StakeManagerFactory = await ethers.getContractFactory("StakeManager");
    const newStakeManager = await StakeManagerFactory.deploy();
    const ProxyFactory = await ethers.getContractFactory("OwnedUpgradeabilityProxy");
    const toUpdate = await ProxyFactory.attach(STAKE_MANAGER);
    await toUpdate.connect(owner).upgradeTo(newStakeManager.address);
    stakeManager = await StakeManagerFactory.attach(STAKE_MANAGER);
  });

  it("from head to tail", async function(){
    buckets = new Set<number>();
    resets = new Set<number>();
    expiry = new Map<string, number>();
    nodes = new Array<string>();
    bucketElements = new Map<number, Array<string>>();
    const head = await stakeManager.head();
    let cursor = head;
    let before = BigNumber.from("0");
    while(cursor.toString() != "0"){
      const info = await stakeManager.infos(cursor);
      console.log("INFO KEY : "+cursor);
      console.log("next : " + info.next);
      console.log("expiresAt : " + info.expiresAt.toNumber());
      console.log("BUCKET : " + getBucket(info.expiresAt));
      if( !(before.toNumber() <= info.expiresAt.toNumber()) ){
        console.log("NOT IN ORDER");
        resets.add(cursor);
        resets.add(info.prev);
      }
      buckets.add(getBucket(info.expiresAt).toNumber());
      let elems = bucketElements.get(getBucket(info.expiresAt).toNumber());
      if(elems === undefined){
        elems = new Array<string>();
      }
      elems.push(cursor);
      nodes.push(cursor);
      expiry.set(cursor, info.expiresAt.toNumber());
      bucketElements.set(getBucket(info.expiresAt).toNumber(), elems);
      cursor = info.next;
      before = info.expiresAt;
    }
  });

  it("buckets ", async function(){
    const array = Array.from(buckets).sort();
    const param0 = new Array<string>();
    const param1 = new Array<string>();
    const param2 = new Array<string>();
    
    //for(let b=array[0]; b<=array[array.length - 1]; b+=3*86400){
    for( let i=0; i<array.length; i++){
      let b = array[i];
      console.log(b);
      const bucket = await stakeManager.checkPoints(b);
      let elems = bucketElements.get(b);
      if(elems === undefined){
        if(bucket.head.toNumber() != 0 || bucket.tail.toNumber() !=0){
          console.log("SHOULD_BE_EMPTY : " + b);
          console.log("HEAD : " + bucket.head);
          console.log("TAIL : " + bucket.tail);
        }
      }
      else {
        elems = elems.sort((x,y) => expiry.get(x) < expiry.get(y) ? -1 : 1)
        if(elems[0].toString() === bucket.head.toString() && elems[elems.length - 1].toString() === bucket.tail.toString()){
        }else{
          console.log("BUCKET : "+ b);
          console.log("ON-CHAIN data");
          console.log("HEAD : " + bucket.head);
          console.log("TAIL : " + bucket.tail);
          console.log("SHOULD BE");
          console.log("HEAD : " + elems[0]);
          console.log("TAIL : " + elems[elems.length - 1]);
          console.log("RESETTING...");

       
          param0.push(b.toString());
          param1.push(elems[0].toString());
          param2.push(elems[elems.length - 1].toString());
        }
      }
    }
    await stakeManager.connect(owner).forceResetExpires(Array.from(resets));
    await stakeManager.connect(owner).resetBuckets(param0, param1, param2);
  });
  
  it("from head to tail : after reset", async function(){
    const head = await stakeManager.head();
    let cursor = head;
    let before = BigNumber.from("0");
    while(cursor.toString() != "0"){
      const info = await stakeManager.infos(cursor);
      console.log("CURSOR : " + cursor);
      console.log("Before : " + before);
      console.log("expires At : " + info.expiresAt);
      expect(before.toNumber() <= info.expiresAt.toNumber()).to.equal(true);
      let elems = bucketElements.get(getBucket(info.expiresAt).toNumber());
      if(elems === undefined){
        elems = new Array<string>();
      }
      cursor = info.next;
      before = info.expiresAt;
    }
  });
  
  it("after cleanup : buckets", async function(){
    const array = Array.from(buckets).sort();
    for(let i = 0; i<array.length; i++){
      const bucket = await stakeManager.checkPoints(array[i]);
      const elems = bucketElements.get(array[i]);
      expect(elems[0].toString() === bucket.head.toString() && elems[elems.length - 1].toString() === bucket.tail.toString()).to.equal(true);
    }
  });
});
