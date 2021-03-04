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
  before(async function(){
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
    console.log(bucket);
    await stakeManager.connect(owner).forceResetExpires([NFT_TO_RESCUE]);
    const newCheckpoint = TARGET_EXPIRE_AT.div(86400).mul(86400);
    bucket = await stakeManager.checkPoints(oldCheckpoint);
    console.log(bucket);
  });

  it("should clean up the bucket", async function(){
    const checkpoint = TARGET_EXPIRE_AT.div(86400 * 3).mul(86400 * 3);
    let bucket = await stakeManager.checkPoints(checkpoint);
    console.log(bucket);
  });

  it("should be able to force remove", async function(){
    await stakeManager.connect(owner).forceRemoveNft(NFT_OWNERS.slice(0,1), NFT_TO_WITHDRAW.slice(0,1));
  });

  it("should be able to withdraw when time passed", async function(){
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [NFT_OWNERS[1]]
    });
    const user = await ethers.provider.getSigner(NFT_OWNERS[1]);
    await increase(7 * 86400);
    await stakeManager.connect(user).withdrawNft(NFT_TO_WITHDRAW[1]);
    await expect(stakeManager.connect(owner).forceRemoveNft(NFT_OWNERS.slice(1,2), NFT_TO_WITHDRAW.slice(1,2))).to.be.reverted;
    await stakeManager.connect(user).withdrawNft(NFT_TO_WITHDRAW[2]);
    await expect(stakeManager.connect(owner).forceRemoveNft(NFT_OWNERS.slice(2,3), NFT_TO_WITHDRAW.slice(2,3))).to.be.reverted;
  });
});
