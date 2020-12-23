import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { time } from "@openzeppelin/test-helpers";
import { increase } from "../utils";

function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}
describe("RewardManager", function () {
  let accounts: Signer[];
  let rewardManager: Contract;
  let stakeManager: Signer;
  let token: Contract;
  let master: Contract;

  let user: Signer;
  let owner: Signer;
  let rewardDistribution: Signer;
  let amount = 1000000;
  let rewardAmount = amount * 100;
  beforeEach(async function () {
    accounts = await ethers.getSigners(); 
    user = accounts[4];
    owner = accounts[0];
    rewardDistribution = accounts[2];
    stakeManager = accounts[1];

    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    master = await MasterFactory.deploy();
    await master.connect(owner).initialize();
    
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    token = await TokenFactory.connect(owner).deploy();
    
    const RewardFactory = await ethers.getContractFactory("RewardManager");
    rewardManager = await RewardFactory.deploy();
    await rewardManager.connect(owner).initialize(master.address, token.address, await rewardDistribution.getAddress());
    await master.connect(owner).registerModule(stringToBytes32("REWARD"), rewardManager.address);

    await master.connect(owner).registerModule(stringToBytes32("STAKE"), await stakeManager.getAddress());
  });

  describe('#initialize()', function(){
    it('should fail if already initialized', async function(){
      await expect(rewardManager.connect(owner).initialize(token.address, await stakeManager.getAddress(), await rewardDistribution.getAddress())).to.be.revertedWith("already initialized");
    });
  });

  describe('#setRewardDistribution()', function(){
    it('should fail if msg.sender is not owner', async function(){
      await expect(rewardManager.connect(user).setRewardDistribution(await user.getAddress())).to.be.revertedWith("only owner can call this function");
    });

    it('should change reward distribution address', async function(){
      await rewardManager.connect(owner).setRewardDistribution(await user.getAddress());
      expect(await rewardManager.rewardDistribution()).to.be.equal(await user.getAddress());
    });
  });

  describe('#notifyRewardAmount()', function(){
    it('should fail if msg.sender is not rewardDistribution', async function(){
      await token.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await token.connect(rewardDistribution).approve(rewardManager.address, 10000);
      await expect(rewardManager.connect(user).notifyRewardAmount(100)).to.be.revertedWith('Caller is not reward distribution');
    });

    it('should fail if token is not approved', async function(){
      await token.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await token.connect(rewardDistribution).approve(rewardManager.address, 1);
      await expect(rewardManager.connect(rewardDistribution).notifyRewardAmount(100)).to.be.reverted;
    });
    
    it('should increase token balance', async function(){
      await token.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await token.connect(rewardDistribution).approve(rewardManager.address, 10000);
      await rewardManager.connect(rewardDistribution).notifyRewardAmount(100);
      expect(await token.balanceOf(rewardManager.address)).to.equal(100);
    });

    it('should be able to notify when period is not finished', async function(){
      await token.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await token.connect(rewardDistribution).approve(rewardManager.address, 10000);
      await rewardManager.connect(rewardDistribution).notifyRewardAmount(100);
      await increase(10000);
      await token.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await token.connect(rewardDistribution).approve(rewardManager.address, 10000);
      await rewardManager.connect(rewardDistribution).notifyRewardAmount(100);
    });
  });

  describe('#stake()', function(){
    beforeEach(async function(){
      await token.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
      await token.connect(rewardDistribution).approve(rewardManager.address, rewardAmount);
      await rewardManager.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
    });
    it('should fail if msg.sender is not stake manager', async function(){
      await expect(rewardManager.connect(owner).stake(await user.getAddress(), amount)).to.be.revertedWith('only module STAKE can call this function');
    });

    it('should increase total supply', async function(){
      await rewardManager.connect(stakeManager).stake(await user.getAddress(), amount);
      expect(await rewardManager.totalSupply()).to.be.equal(amount);
    });

    it('should increase balanceOf user', async function(){
      const address = await user.getAddress();
      await rewardManager.connect(stakeManager).stake(address, amount);
      expect(await rewardManager.balanceOf(address)).to.be.equal(amount);
    });
  });
  
  describe('#withdraw()', function(){
    beforeEach(async function(){
      await token.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
      await token.connect(rewardDistribution).approve(rewardManager.address, rewardAmount);
      await rewardManager.connect(stakeManager).stake(await user.getAddress(), amount);
      await rewardManager.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
      await increase(100);
    });

    it('should fail if msg.sender is not stake manager', async function(){
      await expect(rewardManager.connect(owner).withdraw(await user.getAddress(), amount)).to.be.revertedWith('only module STAKE can call this function');
    });

    it('should decrease total supply', async function(){
      await rewardManager.connect(stakeManager).withdraw(await user.getAddress(), amount);
      expect(await rewardManager.totalSupply()).to.be.equal(0);
    });

    it('should decrease balanceOf user', async function(){
      const address = await user.getAddress();
      await rewardManager.connect(stakeManager).withdraw(address, amount);
      expect(await rewardManager.balanceOf(address)).to.be.equal(0);
    });

    it('should not decrease reward amount', async function(){
      const address = await user.getAddress();
      await rewardManager.connect(stakeManager).withdraw(address, amount);
      expect(await rewardManager.rewards(address)).to.not.equal(0);
    });
  });
  
  describe('#exit()', function(){
    beforeEach(async function(){
      await token.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
      await token.connect(rewardDistribution).approve(rewardManager.address, rewardAmount);
      await rewardManager.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
      await rewardManager.connect(stakeManager).stake(await user.getAddress(), amount);
      await increase(100);
    });

    it('should fail if msg.sender is not stake manager', async function(){
      await expect(rewardManager.connect(owner).exit(await user.getAddress())).to.be.revertedWith('only module STAKE can call this function');
    });

    it('should decrease total supply', async function(){
      await rewardManager.connect(stakeManager).exit(await user.getAddress());
      expect(await rewardManager.totalSupply()).to.be.equal(0);
    });

    it('should decrease balanceOf user', async function(){
      const address = await user.getAddress();
      await rewardManager.connect(stakeManager).exit(address);
      expect(await rewardManager.balanceOf(address)).to.be.equal(0);
    });
    
    it('should decrease reward amount', async function(){
      const address = await user.getAddress();
      await rewardManager.connect(stakeManager).exit(address);
      expect(await rewardManager.rewards(address)).to.be.equal(0);
    });
  });
  describe('#getReward()', function(){
    beforeEach(async function(){
      await token.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
      await token.connect(rewardDistribution).approve(rewardManager.address, rewardAmount);
      await rewardManager.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
      await rewardManager.connect(stakeManager).stake(await user.getAddress(), amount);
      await increase(86400*10);
    });

    it('should be rewarded for all reward amount', async function(){
      const earned = await rewardManager.earned(await user.getAddress());
      await rewardManager.getReward(await user.getAddress());
      const balance = await token.balanceOf(await user.getAddress());
      expect(earned).to.be.equal(balance);
    });

    it('should do nothing when earned is zero', async function(){
      await rewardManager.getReward(await owner.getAddress());
    });
  });
});
