import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { time } from "@openzeppelin/test-helpers";
import { increase, mine } from "../utils";
describe("GovernanceStaker", function () {
  let accounts: Signer[];
  let governanceStaker: Contract;
  let stakeManager: Signer;
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
    stakeManager = accounts[1];
    rewardDistribution = accounts[2];
    rewardToken = await TokenFactory.connect(owner).deploy();
    stakingToken = await TokenFactory.connect(owner).deploy();

    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    master = await MasterFactory.deploy();
    await master.connect(owner).initialize();
  });

  describe('#setRewardDistribution()', function(){
    beforeEach(async function(){
      const GovernanceStakerFactory = await ethers.getContractFactory("GovernanceStaker");
      governanceStaker = await GovernanceStakerFactory.connect(owner).deploy(stakingToken.address, rewardToken.address, master.address);
      await governanceStaker.connect(owner).setRewardDistribution(await rewardDistribution.getAddress());
    });
    it('should fail if msg.sender is not owner', async function(){
      await expect(governanceStaker.connect(user).setRewardDistribution(await user.getAddress())).to.be.revertedWith("only owner can call this function");
    });

    it('should change reward distribution address', async function(){
      await governanceStaker.connect(owner).setRewardDistribution(await user.getAddress());
      expect(await governanceStaker.rewardDistribution()).to.be.equal(await user.getAddress());
    });
  });
  describe('when reward token is eth', function(){
    beforeEach(async function(){
      const GovernanceStakerFactory = await ethers.getContractFactory("GovernanceStaker");
      governanceStaker = await GovernanceStakerFactory.connect(owner).deploy(stakingToken.address, constants.AddressZero, master.address);
      await governanceStaker.connect(owner).setRewardDistribution(await rewardDistribution.getAddress());
    });
    describe('#notifyRewardAmount()', function(){
      it('should fail if msg.sender is not rewardDistribution', async function(){
        await expect(governanceStaker.connect(user).notifyRewardAmount(100,{value:100})).to.be.revertedWith('Caller is not reward distribution');
      });

      it('should fail if msg.value does not match amount zero', async function(){
        await expect(governanceStaker.connect(rewardDistribution).notifyRewardAmount(100, {value:1})).to.be.reverted;
      });

      it('should be able to notify when period is not finished', async function(){
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(100,{value:100});
        await increase(10000);
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(100,{value:100});
      });
    });

    describe('#stake()', function(){
      beforeEach(async function(){
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(rewardAmount, {value:rewardAmount});
      });

      it('should fail if amount is zero', async function(){
        await expect(governanceStaker.connect(user).stake(0)).to.be.reverted;

      });

      it('should increase total supply', async function(){
        await stakingToken.connect(owner).mint(await user.getAddress(), amount);
        await stakingToken.connect(user).approve(governanceStaker.address, amount);
        await governanceStaker.connect(user).stake(amount);
        expect(await governanceStaker.totalSupply()).to.be.equal(amount);
      });

      it('should increase balanceOf user', async function(){
        const address = await user.getAddress();
        await stakingToken.connect(owner).mint(await user.getAddress(), amount);
        await stakingToken.connect(user).approve(governanceStaker.address, amount);
        await governanceStaker.connect(user).stake(amount);
        expect(await governanceStaker.balanceOf(address)).to.be.equal(amount);
      });
    });

    describe('#withdraw()', function(){
      beforeEach(async function(){
        await stakingToken.connect(owner).mint(await user.getAddress(), amount);
        await stakingToken.connect(user).approve(governanceStaker.address, amount);
        await governanceStaker.connect(user).stake(amount);
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(rewardAmount, {value:rewardAmount});
        await increase(100);
      });
      
      it('should fail if amount is zero', async function(){
        await expect(governanceStaker.connect(user).withdraw(0)).to.be.reverted;

      });

      it('should decrease total supply', async function(){
        await governanceStaker.connect(user).withdraw(amount);
        expect(await governanceStaker.totalSupply()).to.be.equal(0);
      });

      it('should decrease balanceOf user', async function(){
        const address = await user.getAddress();
        await governanceStaker.connect(user).withdraw(amount);
        expect(await governanceStaker.balanceOf(address)).to.be.equal(0);
      });

      it('should not decrease reward amount', async function(){
        const address = await user.getAddress();
        await governanceStaker.connect(user).withdraw(amount);
        expect(await governanceStaker.rewards(address)).to.not.equal(0);
      });
    });

    describe('#exit()', function(){
      beforeEach(async function(){
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(rewardAmount, {value:rewardAmount});
        await stakingToken.connect(owner).mint(await user.getAddress(), amount);
        await stakingToken.connect(user).approve(governanceStaker.address, amount);
        await governanceStaker.connect(user).stake(amount);
        await increase(100);
      });

      it('should decrease total supply', async function(){
        await governanceStaker.connect(user).exit();
        expect(await governanceStaker.totalSupply()).to.be.equal(0);
      });

      it('should decrease balanceOf user', async function(){
        const address = await user.getAddress();
        await governanceStaker.connect(user).exit();
        expect(await governanceStaker.balanceOf(address)).to.be.equal(0);
      });

      it('should decrease reward amount', async function(){
        const address = await user.getAddress();
        await governanceStaker.connect(user).exit();
        expect(await governanceStaker.rewards(address)).to.be.equal(0);
      });
    });
    describe('#getReward()', function(){
      beforeEach(async function(){
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(rewardAmount, {value:rewardAmount});
        await stakingToken.connect(owner).mint(await user.getAddress(), amount);
        await stakingToken.connect(user).approve(governanceStaker.address, amount);
        await governanceStaker.connect(user).stake(amount);
        await increase(86400*10);
      });

      it('should do nothing when earned is zero', async function(){
        await mine();
        await governanceStaker.connect(accounts[7]).getReward();
      });
    });
  });

  describe('when reward token is not eth', function(){
    beforeEach(async function(){
      const GovernanceStakerFactory = await ethers.getContractFactory("GovernanceStaker");
      governanceStaker = await GovernanceStakerFactory.connect(owner).deploy(stakingToken.address, rewardToken.address, master.address);
      await governanceStaker.connect(owner).setRewardDistribution(await rewardDistribution.getAddress());
    });
    describe('#notifyRewardAmount()', function(){
      it('should fail if msg.sender is not rewardDistribution', async function(){
        await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
        await rewardToken.connect(rewardDistribution).approve(governanceStaker.address, 10000);
        await expect(governanceStaker.connect(user).notifyRewardAmount(100)).to.be.revertedWith('Caller is not reward distribution');
      });

      it('should fail if token is not approved', async function(){
        await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
        await rewardToken.connect(rewardDistribution).approve(governanceStaker.address, 1);
        await expect(governanceStaker.connect(rewardDistribution).notifyRewardAmount(100)).to.be.reverted;
      });

      it('should fail if msg.value is not zero', async function(){
        await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
        await rewardToken.connect(rewardDistribution).approve(governanceStaker.address, 100);
        await expect(governanceStaker.connect(rewardDistribution).notifyRewardAmount(100, {value:100})).to.be.reverted;
      });

      it('should increase token balance', async function(){
        await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
        await rewardToken.connect(rewardDistribution).approve(governanceStaker.address, 10000);
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(100);
        expect(await rewardToken.balanceOf(governanceStaker.address)).to.equal(100);
      });

      it('should be able to notify when period is not finished', async function(){
        await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
        await rewardToken.connect(rewardDistribution).approve(governanceStaker.address, 10000);
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(100);
        await increase(10000);
        await rewardToken.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
        await rewardToken.connect(rewardDistribution).approve(governanceStaker.address, 10000);
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(100);
      });
    });

    describe('#stake()', function(){
      beforeEach(async function(){
        await rewardToken.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
        await rewardToken.connect(rewardDistribution).approve(governanceStaker.address, rewardAmount);
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
      });

      it('should increase total supply', async function(){
        await stakingToken.connect(owner).mint(await user.getAddress(), amount);
        await stakingToken.connect(user).approve(governanceStaker.address, amount);
        await governanceStaker.connect(user).stake(amount);
        expect(await governanceStaker.totalSupply()).to.be.equal(amount);
      });

      it('should increase balanceOf user', async function(){
        const address = await user.getAddress();
        await stakingToken.connect(owner).mint(await user.getAddress(), amount);
        await stakingToken.connect(user).approve(governanceStaker.address, amount);
        await governanceStaker.connect(user).stake(amount);
        expect(await governanceStaker.balanceOf(address)).to.be.equal(amount);
      });
    });

    describe('#withdraw()', function(){
      beforeEach(async function(){
        await rewardToken.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
        await rewardToken.connect(rewardDistribution).approve(governanceStaker.address, rewardAmount);
        await stakingToken.connect(owner).mint(await user.getAddress(), amount);
        await stakingToken.connect(user).approve(governanceStaker.address, amount);
        await governanceStaker.connect(user).stake(amount);
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
        await increase(100);
      });

      it('should decrease total supply', async function(){
        await governanceStaker.connect(user).withdraw(amount);
        expect(await governanceStaker.totalSupply()).to.be.equal(0);
      });

      it('should decrease balanceOf user', async function(){
        const address = await user.getAddress();
        await governanceStaker.connect(user).withdraw(amount);
        expect(await governanceStaker.balanceOf(address)).to.be.equal(0);
      });

      it('should not decrease reward amount', async function(){
        const address = await user.getAddress();
        await governanceStaker.connect(user).withdraw(amount);
        expect(await governanceStaker.rewards(address)).to.not.equal(0);
      });
    });

    describe('#exit()', function(){
      beforeEach(async function(){
        await rewardToken.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
        await rewardToken.connect(rewardDistribution).approve(governanceStaker.address, rewardAmount);
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
        await stakingToken.connect(owner).mint(await user.getAddress(), amount);
        await stakingToken.connect(user).approve(governanceStaker.address, amount);
        await governanceStaker.connect(user).stake(amount);
        await increase(100);
      });

      it('should decrease total supply', async function(){
        await governanceStaker.connect(user).exit();
        expect(await governanceStaker.totalSupply()).to.be.equal(0);
      });

      it('should decrease balanceOf user', async function(){
        const address = await user.getAddress();
        await governanceStaker.connect(user).exit();
        expect(await governanceStaker.balanceOf(address)).to.be.equal(0);
      });

      it('should decrease reward amount', async function(){
        const address = await user.getAddress();
        await governanceStaker.connect(user).exit();
        expect(await governanceStaker.rewards(address)).to.be.equal(0);
      });
    });
    describe('#getReward()', function(){
      beforeEach(async function(){
        await rewardToken.connect(owner).mint(await rewardDistribution.getAddress(), rewardAmount);
        await rewardToken.connect(rewardDistribution).approve(governanceStaker.address, rewardAmount);
        await governanceStaker.connect(rewardDistribution).notifyRewardAmount(rewardAmount);
        await stakingToken.connect(owner).mint(await user.getAddress(), amount);
        await stakingToken.connect(user).approve(governanceStaker.address, amount);
        await governanceStaker.connect(user).stake(amount);
        await increase(86400*10);
        await mine();
      });

      it('should be rewarded for all reward amount', async function(){
        const earned = await governanceStaker.earned(await user.getAddress());
        await governanceStaker.connect(user).getReward();
        const balance = await rewardToken.balanceOf(await user.getAddress());
        expect(earned).to.be.equal(balance);
      });

      it('should do nothing when earned is zero', async function(){
        await governanceStaker.connect(accounts[7]).getReward();
      });
    });
  });
});
