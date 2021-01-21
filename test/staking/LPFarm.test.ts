import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { time } from "@openzeppelin/test-helpers";
import { increase } from "../utils";
describe("LPFarm", function () {
  let accounts: Signer[];
  let lpfarm: Contract;
  let rewardToken: Contract;
  let stakingToken: Contract;
  let master: Contract;

  let user: Signer;
  let owner: Signer;
  let rewardDistribution: Signer;
  let amount = 1000000;
  let rewardAmount = amount * 100;
  beforeEach(async function () {
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");

    accounts = await ethers.getSigners(); 
    user = accounts[4];
    owner = accounts[0];
    rewardDistribution = accounts[2];
    rewardToken = await TokenFactory.connect(owner).deploy();
    stakingToken = await TokenFactory.connect(owner).deploy();

    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    master = await MasterFactory.deploy();
    await master.connect(owner).initialize();

    const LPFarmFactory = await ethers.getContractFactory("LPFarm");
    // Throwing Reward Distribution in here instead of master.
    lpfarm = await LPFarmFactory.connect(owner).deploy(stakingToken.address, rewardToken.address, master.address);
    await lpfarm.connect(owner).setRewardDistribution(await rewardDistribution.getAddress());
  });

  describe('#setRewardDistribution()', function(){
    it('should fail if msg.sender is not owner', async function(){
      await expect(lpfarm.connect(user).setRewardDistribution(await user.getAddress())).to.be.revertedWith("only owner can call this function");
    });

    it('should change reward distribution address', async function(){
      await lpfarm.connect(owner).setRewardDistribution(await user.getAddress());
      expect(await lpfarm.rewardDistribution()).to.be.equal(await user.getAddress());
    });
  });
  describe('#notifyRewardAmount()', function(){
    it('should fail if msg.sender is not rewardDistribution', async function(){
      await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await rewardToken.connect(rewardDistribution).approve(lpfarm.address, 10000);
      await expect(lpfarm.connect(user).notifyRewardAmount(100)).to.be.revertedWith('Caller is not reward distribution');
    });

    it('should fail if token is not approved', async function(){
      await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await rewardToken.connect(rewardDistribution).approve(lpfarm.address, 1);
      await expect(lpfarm.connect(rewardDistribution).notifyRewardAmount(100)).to.be.reverted;
    });

    it('should fail if msg.value is not zero', async function(){
      await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await rewardToken.connect(rewardDistribution).approve(lpfarm.address, 100);
      await expect(lpfarm.connect(rewardDistribution).notifyRewardAmount(100, {value:100})).to.be.reverted;
    });

    it('should increase token balance', async function(){
      await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await rewardToken.connect(rewardDistribution).approve(lpfarm.address, 10000);
      await lpfarm.connect(rewardDistribution).notifyRewardAmount(100);
      expect(await rewardToken.balanceOf(lpfarm.address)).to.equal(100);
    });

    it('should be able to notify when period is not finished', async function(){
      await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await rewardToken.connect(rewardDistribution).approve(lpfarm.address, 10000);
      await lpfarm.connect(rewardDistribution).notifyRewardAmount(100);
      await increase(10000);
      await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await rewardToken.connect(rewardDistribution).approve(lpfarm.address, 10000);
      await lpfarm.connect(rewardDistribution).notifyRewardAmount(100);
    });
  });

  describe('#stake()', function(){
    beforeEach(async function(){
      await rewardToken.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
      await rewardToken.connect(rewardDistribution).approve(lpfarm.address, rewardAmount);
      await lpfarm.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
    });

    it('should fail if amount is zero', async function(){
      await expect(lpfarm.connect(user).stake(0)).to.be.reverted;

    });
    it('should increase total supply', async function(){
      await stakingToken.connect(owner).mint(await user.getAddress(), amount);
      await stakingToken.connect(user).approve(lpfarm.address, amount);
      await lpfarm.connect(user).stake(amount);
      expect(await lpfarm.totalSupply()).to.be.equal(amount);
    });

    it('should increase balanceOf user', async function(){
      const address = await user.getAddress();
      await stakingToken.connect(owner).mint(await user.getAddress(), amount);
      await stakingToken.connect(user).approve(lpfarm.address, amount);
      await lpfarm.connect(user).stake(amount);
      expect(await lpfarm.balanceOf(address)).to.be.equal(amount);
    });
  });

  describe('#withdraw()', function(){
    beforeEach(async function(){
      await rewardToken.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
      await rewardToken.connect(rewardDistribution).approve(lpfarm.address, rewardAmount);
      await stakingToken.connect(owner).mint(await user.getAddress(), amount);
      await stakingToken.connect(user).approve(lpfarm.address, amount);
      await lpfarm.connect(user).stake(amount);
      await lpfarm.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
      await increase(100);
    });
    it('should fail if amount is zero', async function(){
      await expect(lpfarm.connect(user).withdraw(0)).to.be.reverted;

    });

    it('should decrease total supply', async function(){
      await lpfarm.connect(user).withdraw(amount);
      expect(await lpfarm.totalSupply()).to.be.equal(0);
    });

    it('should decrease balanceOf user', async function(){
      const address = await user.getAddress();
      await lpfarm.connect(user).withdraw(amount);
      expect(await lpfarm.balanceOf(address)).to.be.equal(0);
    });

    it('should not decrease reward amount', async function(){
      const address = await user.getAddress();
      await lpfarm.connect(user).withdraw(amount);
      expect(await lpfarm.rewards(address)).to.not.equal(0);
    });
  });

  describe('#exit()', function(){
    beforeEach(async function(){
      await rewardToken.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
      await rewardToken.connect(rewardDistribution).approve(lpfarm.address, rewardAmount);
      await lpfarm.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
      await stakingToken.connect(owner).mint(await user.getAddress(), amount);
      await stakingToken.connect(user).approve(lpfarm.address, amount);
      await lpfarm.connect(user).stake(amount);
      await increase(100);
    });

    it('should decrease total supply', async function(){
      await lpfarm.connect(user).exit();
      expect(await lpfarm.totalSupply()).to.be.equal(0);
    });

    it('should decrease balanceOf user', async function(){
      const address = await user.getAddress();
      await lpfarm.connect(user).exit();
      expect(await lpfarm.balanceOf(address)).to.be.equal(0);
    });

    it('should decrease reward amount', async function(){
      const address = await user.getAddress();
      await lpfarm.connect(user).exit();
      expect(await lpfarm.rewards(address)).to.be.equal(0);
    });
  });
  describe('#getReward()', function(){
    beforeEach(async function(){
      await rewardToken.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
      await rewardToken.connect(rewardDistribution).approve(lpfarm.address, rewardAmount);
      await lpfarm.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
      await stakingToken.connect(owner).mint(await user.getAddress(), amount);
      await stakingToken.connect(user).approve(lpfarm.address, amount);
      await lpfarm.connect(user).stake(amount);
      await increase(86400*10);
    });

    it('should be rewarded for all reward amount', async function(){
      const earned = await lpfarm.earned(await user.getAddress());
      await lpfarm.connect(user).getReward();
      const balance = await rewardToken.balanceOf(await user.getAddress());
      expect(earned).to.be.equal(balance);
    });

    it('should do nothing when earned is zero', async function(){
      await lpfarm.connect(accounts[7]).getReward();
    });
  });
});
