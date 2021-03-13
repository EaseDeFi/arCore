import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { increase } from "./utils";
function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}

const ARNFT = "0x1337DEF1e9c7645352D93baf0b789D04562b4185";
const STAKE_MANAGER = "0x1337def1670c54b2a70e590b5654c2b7ce1141a2";
const REWARD_MANAGER = "0x1337DEF17d00FEAeA1fb10E09cAfa56030349Af8";
const UFS = "0x1337DEF1B1Ae35314b40e5A4b70e216A499b0E37";
const ARMOR_MULTISIG = "0x1f28eD9D4792a567DaD779235c2b766Ab84D8E33";
const NFT_TO_RESCUE = BigNumber.from(3531);
const NFT_TO_RESCUE_2 = BigNumber.from(3533);
const TARGET_EXPIRE_AT = BigNumber.from(1622548941);
const TARGET_EXPIRE_AT_2 = BigNumber.from(1622550428);
const NFT_TO_WITHDRAW = [3454, 3344, 3146]
const NFT_OWNERS = [
  "0x8b43adb7c0e01ac5cc4af110c507683b24c648e5", 
  "0xac8eb5c1c12cc1db3e37bb64cc9f2220e16395d9",
  "0xac8eb5c1c12cc1db3e37bb64cc9f2220e16395d9"
];
describe.skip("Hotfix test", function() {
  let accounts: Signer[];
  let stakeManager: Contract;
  let rewardManager: Contract;
  let ufs: Contract;
  let arnft: Contract;
  let owner: Signer;
  beforeEach(async function(){
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ARMOR_MULTISIG]
    });
    owner = await ethers.provider.getSigner(ARMOR_MULTISIG);

    const StakeManagerFactory = await ethers.getContractFactory("StakeManager");
    const RewardManagerFactory = await ethers.getContractFactory("RewardManager");
    const UFSFactory = await ethers.getContractFactory("UtilizationFarm");
    const ARNFTFactory = await ethers.getContractFactory("arNFTMock");
    const newStakeManager = await StakeManagerFactory.deploy();
    stakeManager = await StakeManagerFactory.attach(STAKE_MANAGER);
    rewardManager = await RewardManagerFactory.attach(REWARD_MANAGER);
    ufs = await UFSFactory.attach(UFS);
    arnft = await ARNFTFactory.attach(ARNFT);
    const ProxyFactory = await ethers.getContractFactory("OwnedUpgradeabilityProxy");
    const toUpdate = await ProxyFactory.attach(STAKE_MANAGER);
    await toUpdate.connect(owner).upgradeTo(newStakeManager.address);
  });

  it("check", async function(){
    const oldCheckpoint = TARGET_EXPIRE_AT.div(86400 * 3).mul(86400 * 3);
    console.log("CHECKPOINT : " + oldCheckpoint);
    const newCheckpoint = TARGET_EXPIRE_AT.div(86400).mul(86400);
    console.log("SHOULD BE : " + newCheckpoint);
    let bucket = await stakeManager.checkPoints(oldCheckpoint);
    let info = await stakeManager.infos(bucket.head);
    let id = bucket.head;
    console.log("BUCKET HEAD : " + id.toNumber());
    console.log(info);
    console.log("HEAD EXPIRES AT : " + info.expiresAt.toNumber());
    while(info.expiresAt.toNumber() != 0 && info.expiresAt.toNumber() >= oldCheckpoint) {
      id = info.prev;
      info = await stakeManager.infos(info.prev);
    }
    const start = id;
    while(info.expiresAt.toNumber() != 0 && info.expiresAt.toNumber() < newCheckpoint.add(86400)) {
      console.log("ID : " + id.toNumber());
      console.log("PREV : " + info.prev.toNumber());
      console.log("NEXT : " + info.next.toNumber());
      console.log("EXPIRES AT : " + info.expiresAt.toNumber());
      console.log("REAL BUCKET : " + info.expiresAt.div(86400).mul(86400));
      id = info.next;
      info = await stakeManager.infos(info.next);
    }
    await stakeManager.connect(owner).forceResetExpires([NFT_TO_RESCUE, NFT_TO_RESCUE_2]);
    info = await stakeManager.infos(start);
    id = start;
    let before = info.expiresAt.toNumber();
    while(info.expiresAt.toNumber() != 0 && info.expiresAt.toNumber() < newCheckpoint.add(86400)) {
      console.log("####INFO###########");
      console.log("ID : " + id.toNumber());
      console.log("PREV : " + info.prev.toNumber());
      console.log("NEXT : " + info.next.toNumber());
      console.log("EXPIRES AT : " + info.expiresAt.toNumber());
      expect(before <= info.expiresAt.toNumber()).to.equal(true);
      before = info.expiresAt.toNumber();
      console.log("BUCKET : " + info.expiresAt.div(86400).mul(86400));
      const bucket_temp = await stakeManager.checkPoints(info.expiresAt.div(86400).mul(86400));
      console.log("####BUCKET INFO####");
      console.log("HEAD : " + bucket_temp.head.toNumber());
      console.log("TAIL : " + bucket_temp.tail.toNumber());
      id = info.next;
      info = await stakeManager.infos(info.next);
    }
    bucket = await stakeManager.checkPoints(oldCheckpoint);
    expect(bucket.head).to.equal(0);
    expect(bucket.tail).to.equal(0);
  });

  it("should clean up the bucket", async function(){
    const checkpoint = TARGET_EXPIRE_AT.div(86400 * 3).mul(86400 * 3);
    let bucket = await stakeManager.checkPoints(checkpoint);
    // this thing does not needs to be called since we were lucky
  });

  it("should be able to force remove", async function(){
    const info = await stakeManager.infos(NFT_TO_WITHDRAW[0]);
    const info_prev = await stakeManager.infos(info.prev);
    const info_next = await stakeManager.infos(info.next);
    const arnft_expiry = (await arnft.getToken(NFT_TO_WITHDRAW[0])).validUntil;
    const checkpoint = arnft_expiry.div(86400).mul(86400);
    const bucket = await stakeManager.checkPoints(checkpoint);
    await stakeManager.connect(owner).forceRemoveNft(NFT_OWNERS.slice(0,1), NFT_TO_WITHDRAW.slice(0,1));
    const info_effect = await stakeManager.infos(NFT_TO_WITHDRAW[0]);
    const info_prev_effect = await stakeManager.infos(info.prev);
    const info_next_effect = await stakeManager.infos(info.next);
    expect(info_prev_effect.next).to.equal(info.next);
    expect(info_next_effect.prev).to.equal(info.prev);
    const bucket_effect = await stakeManager.checkPoints(checkpoint);
    if(bucket.head.toNumber() === NFT_TO_WITHDRAW[0] && bucket.tail.toNumber() === NFT_TO_WITHDRAW[0]){
      expect(bucket_effect.head).to.equal(0);
      expect(bucket_effect.tail).to.equal(0);
    } else if(bucket.head.toNumber() === NFT_TO_WITHDRAW[0]){
      expect(bucket_effect.head).to.equal(info.next);
      expect(bucket_effect.tail).to.equal(bucket.tail);
    } else if(bucket.tail.toNumber() === NFT_TO_WITHDRAW[0]){
      expect(bucket_effect.head).to.equal(bucket.head);
      expect(bucket_effect.tail).to.equal(info.prev);
    }
  });

  it("should be able to withdraw when time passed", async function(){
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [NFT_OWNERS[1]]
    });
    const user = await ethers.provider.getSigner(NFT_OWNERS[1]);
    await increase(7 * 86400);
    /// withdrawing nft[1]
    {
      const info = await stakeManager.infos(NFT_TO_WITHDRAW[1]);
      const info_prev = await stakeManager.infos(info.prev);
      const info_next = await stakeManager.infos(info.next);
      const arnft_expiry = (await arnft.getToken(NFT_TO_WITHDRAW[1])).validUntil;
      const checkpoint = arnft_expiry.div(86400).mul(86400);
      const bucket = await stakeManager.checkPoints(checkpoint);
      await stakeManager.connect(user).withdrawNft(NFT_TO_WITHDRAW[1]);
      const info_effect = await stakeManager.infos(NFT_TO_WITHDRAW[1]);
      const info_prev_effect = await stakeManager.infos(info.prev);
      const info_next_effect = await stakeManager.infos(info.next);
      expect(info_prev_effect.next).to.equal(info.next);
      expect(info_next_effect.prev).to.equal(info.prev);
      const bucket_effect = await stakeManager.checkPoints(checkpoint);
      if(bucket.head.toNumber() === NFT_TO_WITHDRAW[1] && bucket.tail.toNumber() === NFT_TO_WITHDRAW[1]){
        expect(bucket_effect.head).to.equal(0);
        expect(bucket_effect.tail).to.equal(0);
      } else if(bucket.head.toNumber() === NFT_TO_WITHDRAW[1]){
        expect(bucket_effect.head).to.equal(info.next);
        expect(bucket_effect.tail).to.equal(bucket.tail);
      } else if(bucket.tail.toNumber() === NFT_TO_WITHDRAW[1]){
        expect(bucket_effect.head).to.equal(bucket.head);
        expect(bucket_effect.tail).to.equal(info.prev);
      }
    }
    /// withdrawing nft[2]
    {
      const info_2 = await stakeManager.infos(NFT_TO_WITHDRAW[2]);
      const info_prev_2 = await stakeManager.infos(info_2.prev);
      const info_next_2 = await stakeManager.infos(info_2.next);
      const arnft_expiry_2 = (await arnft.getToken(NFT_TO_WITHDRAW[2])).validUntil;
      const checkpoint_2 = arnft_expiry_2.div(86400).mul(86400);
      const bucket_2 = await stakeManager.checkPoints(checkpoint_2);
      await stakeManager.connect(user).withdrawNft(NFT_TO_WITHDRAW[2]);
      const info_effect_2 = await stakeManager.infos(NFT_TO_WITHDRAW[2]);
      const info_prev_effect_2 = await stakeManager.infos(info_2.prev);
      const info_next_effect_2 = await stakeManager.infos(info_2.next);
      expect(info_prev_effect_2.next).to.equal(info_2.next);
      expect(info_next_effect_2.prev).to.equal(info_2.prev);
      const bucket_effect_2 = await stakeManager.checkPoints(checkpoint_2);
      if(bucket_2.head.toNumber() === NFT_TO_WITHDRAW[2] && bucket_2.tail.toNumber() === NFT_TO_WITHDRAW[2]){
        expect(bucket_effect_2.head).to.equal(0);
        expect(bucket_effect_2.tail).to.equal(0);
      } else if(bucket_2.head.toNumber() === NFT_TO_WITHDRAW[2]){
        expect(bucket_effect_2.head).to.equal(info_2.next);
        expect(bucket_effect_2.tail).to.equal(bucket_2.tail);
      } else if(bucket_2.tail.toNumber() === NFT_TO_WITHDRAW[2]){
        expect(bucket_effect_2.head).to.equal(bucket_2.head);
        expect(bucket_effect_2.tail).to.equal(info_2.prev);
      }
    }
  });
});
