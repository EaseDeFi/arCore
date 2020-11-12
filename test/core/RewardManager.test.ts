import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { time } from "@openzeppelin/test-helpers";
describe("RewardManager", function () {
  let accounts: Signer[];
  let rewardManager: Contract;
  let stakeManager: Signer;
  let token: Contract;

  let user: Signer;
  let owner: Signer;
  let rewardDistribution: Signer;
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

  describe.only('#notifyRewardAmount()', function(){
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
    
    it('should fail increase token balance', async function(){
      await token.connect(owner).transfer(await rewardDistribution.getAddress(), 10000);
      await token.connect(rewardDistribution).approve(rewardManager.address, 10000);
      await rewardManager.connect(rewardDistribution).notifyRewardAmount(100);
      expect(await token.balanceOf(rewardManager.address)).to.equal(100);
    });
  });
});
