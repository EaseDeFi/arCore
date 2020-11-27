import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { time } from "@openzeppelin/test-helpers";
import { increase } from "../utils";
describe("RewardManager", function () {
  let accounts: Signer[];
  let rewardManager: Contract;
  let stakeManager: Signer;
  let token: Contract;

  let user: Signer;
  let owner: Signer;
  let rewardDistribution: Signer;
  let amount = 1000000;
  beforeEach(async function () {
    const RewardFactory = await ethers.getContractFactory("RewardManager");
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    rewardManager = await RewardFactory.deploy();
    
    accounts = await ethers.getSigners(); 
    user = accounts[4];
    owner = accounts[0];
    stakeManager = accounts[1];
    rewardDistribution = accounts[2];
    token = await TokenFactory.connect(owner).deploy();
    await rewardManager.connect(owner).initialize(token.address, await stakeManager.getAddress(), await rewardDistribution.getAddress());
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
    it('should fail if msg.sender is not stake manager', async function(){
      await expect(rewardManager.connect(owner).stake(await user.getAddress(), amount)).to.be.revertedWith('Caller is not the stake controller');
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
      await rewardManager.connect(stakeManager).stake(await user.getAddress(), amount);
    });

    it('should fail if msg.sender is not stake manager', async function(){
      await expect(rewardManager.connect(owner).withdraw(await user.getAddress(), amount)).to.be.revertedWith('Caller is not the stake controller');
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
  });
});
