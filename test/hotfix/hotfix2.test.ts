import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { increase } from "../utils";
function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}

let buckets : Set<number>;

let bucketElements : Map<number, Array<string>>;

const BALANCE_MANAGER = "0x1337DEF1c5EbBd9840E6B25C4438E829555395AA";
const ARMOR_MULTISIG = "0x1f28eD9D4792a567DaD779235c2b766Ab84D8E33";
function getBucket(expiry: BigNumber) : BigNumber {
  return (expiry.div(3*86400)).mul(3*86400);
}
describe.skip("Hotfix test", function() {
  let accounts: Signer[];
  let balanceManager: Contract;
  let owner: Signer;
  
  before(async function(){
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ARMOR_MULTISIG]
    });
    owner = await ethers.provider.getSigner(ARMOR_MULTISIG);
    const BalanceManagerFactory = await ethers.getContractFactory("BalanceManager");
    const newBalanceManager = await BalanceManagerFactory.deploy();
    const ProxyFactory = await ethers.getContractFactory("OwnedUpgradeabilityProxy");
    const toUpdate = await ProxyFactory.attach(BALANCE_MANAGER);
    await toUpdate.connect(owner).upgradeTo(newBalanceManager.address);
    balanceManager = await BalanceManagerFactory.attach(BALANCE_MANAGER);
  });

  it("from head to tail", async function(){
    buckets = new Set<number>();
    bucketElements = new Map<number, Array<string>>();
    const head = await balanceManager.head();
    let cursor = head;
    let before = BigNumber.from("0");
    while(cursor.toString() != "0"){
      const info = await balanceManager.infos(cursor);
      console.log("INFO KEY : "+cursor);
      console.log("prev : " + info.prev);
      console.log("next : " + info.next);
      console.log("before : " + before.toNumber());
      console.log("expiresAt : " + info.expiresAt.toNumber());
      expect(before.toNumber() <= info.expiresAt.toNumber()).to.equal(true);
      console.log("BUCKET : " + getBucket(info.expiresAt));
      buckets.add(getBucket(info.expiresAt).toNumber());
      let elems = bucketElements.get(getBucket(info.expiresAt).toNumber());
      if(elems === undefined){
        elems = new Array<string>();
      }
      elems.push(cursor);
      console.log("ELEMS : " + elems);
      bucketElements.set(getBucket(info.expiresAt).toNumber(), elems);
      cursor = info.next;
      before = info.expiresAt;
    }
  });
  
  it("from tail to head", async function(){
    const tail = await balanceManager.tail();
    let cursor = tail;
    let before = BigNumber.from(10420116075);
    while(cursor.toString() != "0"){
      const info = await balanceManager.infos(cursor);
      console.log("INFO KEY : "+cursor);
      console.log("prev : " + info.prev);
      console.log("next : " + info.next);
      console.log("before : " + before.toNumber());
      console.log("expiresAt : " + info.expiresAt.toNumber());
      expect(before.toNumber() >= info.expiresAt.toNumber()).to.equal(true);
      console.log("IN ORDER? : " + (before.toNumber() >= info.expiresAt.toNumber()));
      cursor = info.prev;
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
      const bucket = await balanceManager.checkPoints(b);
      const elems = bucketElements.get(b);
      if(elems === undefined){
        if(bucket.head.toNumber() != 0 || bucket.tail.toNumber() !=0){
          console.log("SHOULD_BE_EMPTY : " + b);
          console.log("HEAD : " + bucket.head);
          console.log("TAIL : " + bucket.tail);
        }
      }
      else if(elems[0].toString() === bucket.head.toString() && elems[elems.length - 1].toString() === bucket.tail.toString()){
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
    await balanceManager.connect(owner).resetBuckets(param0, param1, param2);
    console.log("buckets");
    console.log(param0);
    console.log("heads");
    console.log(param1);
    console.log("tails");
    console.log(param2);
  });
  
  it("after cleanup : buckets", async function(){
    const array = Array.from(buckets).sort();
    for(let i = 0; i<array.length; i++){
      const bucket = await balanceManager.checkPoints(array[i]);
      const elems = bucketElements.get(array[i]);
      expect(elems[0].toString() === bucket.head.toString() && elems[elems.length - 1].toString() === bucket.tail.toString()).to.equal(true);
    }
  });
});
