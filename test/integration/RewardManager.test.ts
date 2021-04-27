import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { time } from "@openzeppelin/test-helpers";
import { increase, mine } from "../utils";
import { ArmorCore } from "./ArmorCore";
function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}
const ETHER  = BigNumber.from("1000000000000000000");
describe("RewardManager", function () {
  const coverAmount = BigNumber.from("1");
  const price = BigNumber.from("10000000000000"); // this means 0.00001 eth per second
  const userBalance = price.mul(86400*100);
  let amount = 1000000;
  let rewardAmount = amount * 100;
  let accounts: Signer[];
  let token: Contract;
  let armor: ArmorCore;
  let owner: Signer;
  let user: Signer;
  let dev: Signer;
  let referrer: Signer;
  let rewardDistribution: Signer;
  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[3];
    dev = accounts[4];
    referrer = accounts[5];
    rewardDistribution = accounts[5];
    
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    token = await TokenFactory.deploy();

    armor = new ArmorCore(owner);
    await armor.deploy(token);
    await armor.balanceManager.changeRefPercent(0);
    await armor.balanceManager.changeGovPercent(0);
    await armor.balanceManager.changeDevPercent(0);
  });
  async function notifyReward() {
    await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
    await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:userBalance});
    await armor.increaseStake(armor.balanceManager, coverAmount.mul(10));
    await armor.increaseStake(armor.stakeManager, coverAmount.mul(10));
    await armor.setPrice(armor.stakeManager, price);
    await armor.setPrice(armor.balanceManager, price);
    await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
    await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
    await increase(86400*100);
    await armor.master.keepMultiple(100);
    await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
    await armor.balanceManager.releaseFunds();
  }

  describe('#notifyRewardAmount()', function(){
    it('should fail if msg.sender is not rewardDistribution', async function(){
      await token.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await token.connect(rewardDistribution).approve(armor.rewardManager.address, 10000);
      await expect(armor.rewardManager.connect(user).notifyRewardAmount(100)).to.be.revertedWith('only module BALANCE can call this function');
    });

    it('should increase token balance', async function(){
      expect(await owner.provider.getBalance(armor.rewardManager.address)).to.equal(0);
      await notifyReward();
      expect(await owner.provider.getBalance(armor.rewardManager.address)).to.not.equal(0);
    });

  });

  describe('#stake()', function(){
    const NFTID = 1;
    beforeEach(async function(){
      await notifyReward();
    });
    it('should fail if msg.sender is not stake manager', async function(){
      await expect(armor.rewardManager.connect(owner).stake(await user.getAddress(), amount, NFTID)).to.be.revertedWith('only module STAKE can call this function');
    });
  });
  
  describe('#withdraw()', function(){
    let NFTID: BigNumber;
    beforeEach(async function(){
      await notifyReward();
      NFTID = await armor.stake(user, armor.rewardManager, BigNumber.from(amount));
      await increase(100);
    });

    it('should fail if msg.sender is not stake manager', async function(){
      await expect(armor.rewardManager.connect(owner).withdraw(await user.getAddress(), amount, NFTID)).to.be.revertedWith('only module STAKE can call this function');
    });

    it('should decrease total supply', async function(){
      await armor.stakeManager.connect(user).withdrawNft(NFTID);
      await increase(7 * 86400);
      await armor.stakeManager.connect(user).withdrawNft(NFTID);
      expect(await armor.rewardManager.totalSupply()).to.be.equal(0);
    });

    it('should decrease balanceOf user', async function(){
      const address = await user.getAddress();
      await armor.stakeManager.connect(user).withdrawNft(NFTID);
      await increase(7 * 86400);
      await armor.stakeManager.connect(user).withdrawNft(NFTID);
      expect(await armor.rewardManager.balanceOf(address)).to.be.equal(0);
    });

    it('should not decrease reward amount', async function(){
      const address = await user.getAddress();
      await armor.stakeManager.connect(user).withdrawNft(NFTID);
      await increase(7 * 86400);
      await armor.stakeManager.connect(user).withdrawNft(NFTID);
      expect(await armor.rewardManager.rewards(address)).to.not.equal(0);
    });
  });
  
  describe('#getReward()', function(){
    const NFTID = 1;
    beforeEach(async function(){
      await notifyReward();
      await armor.stake(user, armor.rewardManager, BigNumber.from(amount));
      await increase(86400*10);
      await mine();
    });

    it('should be rewarded for all reward amount', async function(){
      const before = await owner.provider.getBalance(await user.getAddress());
      const earned = await armor.rewardManager.earned(await user.getAddress());
      await armor.rewardManager.getReward(await user.getAddress());
      const after = await owner.provider.getBalance(await user.getAddress());
      expect(after).to.be.equal(before.add(earned));
    });

    it('should do nothing when earned is zero', async function(){
      await armor.rewardManager.getReward(await owner.getAddress());
    });
  });
});
