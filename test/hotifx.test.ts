import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { increase } from "./utils";
function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}

const STAKE_MANAGER = "0x1337def1670c54b2a70e590b5654c2b7ce1141a2";
const ARMOR_MULTISIG = "0x1f28eD9D4792a567DaD779235c2b766Ab84D8E33";
const NFT_TO_RESCUE = BigNumber.from(3531);
const TARGET_EXPIRE_AT = BigNumber.from(1622548941);
const NFT_TO_WITHDRAW = [3454, 3344, 3146]
const NFT_OWNERS = [
  "0x8b43adb7c0e01ac5cc4af110c507683b24c648e5", 
  "0xac8eb5c1c12cc1db3e37bb64cc9f2220e16395d9",
  "0xac8eb5c1c12cc1db3e37bb64cc9f2220e16395d9"
];
describe.only("Hotfix test", function() {
  let accounts: Signer[];
  let stakeManager: Contract;
  let owner: Signer;
  beforeEach(async function(){
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ARMOR_MULTISIG]
    });
    owner = await ethers.provider.getSigner(ARMOR_MULTISIG);

    const StakeManagerFactory = await ethers.getContractFactory("StakeManager");
    const newStakeManager = await StakeManagerFactory.deploy();
    stakeManager = await StakeManagerFactory.attach(STAKE_MANAGER);
    const ProxyFactory = await ethers.getContractFactory("OwnedUpgradeabilityProxy");
    const toUpdate = await ProxyFactory.attach(STAKE_MANAGER);
    await toUpdate.connect(owner).upgradeTo(newStakeManager.address);
  });

  it("should be able to call forceReset", async function(){
    const oldCheckpoint = TARGET_EXPIRE_AT.div(86400 * 3).mul(86400 * 3);
    let bucket = await stakeManager.checkPoints(oldCheckpoint);
    await stakeManager.connect(owner).forceResetExpires([NFT_TO_RESCUE]);
    const newCheckpoint = TARGET_EXPIRE_AT.div(86400).mul(86400);
    bucket = await stakeManager.checkPoints(oldCheckpoint);
    // this thing does not needs to be called since we were lucky
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
    await stakeManager.connect(owner).forceRemoveNft(NFT_OWNERS.slice(0,1), NFT_TO_WITHDRAW.slice(0,1));
    const info_effect = await stakeManager.infos(NFT_TO_WITHDRAW[0]);
    const info_prev_effect = await stakeManager.infos(info.prev);
    const info_next_effect = await stakeManager.infos(info.next);
    expect(info_prev_effect.next).to.equal(info.next);
    expect(info_next_effect.prev).to.equal(info.prev);
  });

  it("should be able to withdraw when time passed", async function(){
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [NFT_OWNERS[1]]
    });
    const user = await ethers.provider.getSigner(NFT_OWNERS[1]);
    await increase(7 * 86400);
    const info = await stakeManager.infos(NFT_TO_WITHDRAW[1]);
    const info_prev = await stakeManager.infos(info.prev);
    const info_next = await stakeManager.infos(info.next);
    await stakeManager.connect(user).withdrawNft(NFT_TO_WITHDRAW[1]);
    const info_effect = await stakeManager.infos(NFT_TO_WITHDRAW[1]);
    const info_prev_effect = await stakeManager.infos(info.prev);
    const info_next_effect = await stakeManager.infos(info.next);
    expect(info_prev_effect.next).to.equal(info.next);
    expect(info_next_effect.prev).to.equal(info.prev);
    const info_2 = await stakeManager.infos(NFT_TO_WITHDRAW[2]);
    const info_prev_2 = await stakeManager.infos(info_2.prev);
    const info_next_2 = await stakeManager.infos(info_2.next);
    await stakeManager.connect(user).withdrawNft(NFT_TO_WITHDRAW[2]);
    const info_effect_2 = await stakeManager.infos(NFT_TO_WITHDRAW[2]);
    const info_prev_effect_2 = await stakeManager.infos(info_2.prev);
    const info_next_effect_2 = await stakeManager.infos(info_2.next);
    expect(info_prev_effect_2.next).to.equal(info_2.next);
    expect(info_next_effect_2.prev).to.equal(info_2.prev);
  });
});
