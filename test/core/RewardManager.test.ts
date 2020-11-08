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
    token = await TokenFactory.deploy();
    
    accounts = await ethers.getSigners(); 
    user = accounts[4];
    owner = accounts[0];
    stakeManager = accounts[1];
    rewardDistribution = accounts[2];
    await rewardManager.connect(owner).initialize(token.address, await stakeManager.getAddress(), await rewardDistribution.getAddress());
  });

  describe('#notifyRewardAmount()', function(){
    it('should fail if msg.sender is not rewardDistribution', async function(){
      await expect(rewardManager.notifyRewardAmount(100)).to.be.revertedWith('Caller is not reward distribution');
    });
  });
});
