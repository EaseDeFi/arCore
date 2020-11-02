import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
describe.only("ReawrdManager", function () {
  let accounts: Signer[];
  let rewardManager: Contract;
  let stakeManager: Signer;
  let user: Signer;
  let owner: Signer;
  beforeEach(async function () {
    const RewardFactory = await ethers.getContractFactory("RewardManager");
    accounts = await ethers.getSigners();
    stakeManager = accounts[4];
    user = accounts[3];
    owner = accounts[0];
    rewardManager = await RewardFactory.deploy();
    await rewardManager.connect(owner).initialize(await stakeManager.getAddress());
  });
  
  describe('#deposit()', function() {
    const depositAmount = BigNumber.from(1000);
    it('should fail if msg.sender is not owner', async function(){
      await expect(rewardManager.connect(user).deposit({value:depositAmount})).to.be.revertedWith("msg.sender is not owner");
    });

    it('should fail if msg.value is zero', async function(){
      await expect(rewardManager.connect(owner).deposit({value:0})).to.be.revertedWith("deposit amount should be larger than zero");
    });

    it('should add new Deposit', async function(){
      await rewardManager.connect(owner).deposit({value:depositAmount});
      const deposit = await rewardManager.deposits(0);
      expect(deposit.amount.toString()).to.equal(depositAmount.toString());
    });
  });

  describe('#addStakes()', function() {
    const secondPrice = BigNumber.from(10);
    it('should fail if msg.sender is not stake manager', async function(){
      await expect(rewardManager.connect(user).addStakes(await user.getAddress(), secondPrice)).to.be.revertedWith("Only StakeManager can call this function");
    });

    it('should increase user\'s stake price', async function(){
      const before = await rewardManager.userStakedPrice(await user.getAddress());
      await rewardManager.connect(stakeManager).addStakes(await user.getAddress(), secondPrice);
      const after = await rewardManager.userStakedPrice(await user.getAddress());
      expect(after.toString()).to.equal(before.add(secondPrice).toString());
    });
    
    it('should increase total staked price', async function(){
      const before = await rewardManager.totalStakedPrice();
      await rewardManager.connect(stakeManager).addStakes(await user.getAddress(), secondPrice);
      const after = await rewardManager.totalStakedPrice();
      expect(after.toString()).to.equal(before.add(secondPrice).toString());
    });
  });

  describe('#subStakes()', function() {
    const originalStake = BigNumber.from(10000);
    const secondPrice = BigNumber.from(10);
    beforeEach(async function(){
      await rewardManager.connect(stakeManager).addStakes(await user.getAddress(), originalStake);
    });
    it('should fail if msg.sender is not stake manager', async function(){
      await expect(rewardManager.connect(user).subStakes(await user.getAddress(), secondPrice)).to.be.revertedWith("Only StakeManager can call this function");
    });

    it('should increase user\'s stake price', async function(){
      const before = await rewardManager.userStakedPrice(await user.getAddress());
      await rewardManager.connect(stakeManager).subStakes(await user.getAddress(), secondPrice);
      const after = await rewardManager.userStakedPrice(await user.getAddress());
      expect(after.toString()).to.equal(before.sub(secondPrice).toString());
    });
    
    it('should increase total staked price', async function(){
      const before = await rewardManager.totalStakedPrice();
      await rewardManager.connect(stakeManager).subStakes(await user.getAddress(), secondPrice);
      const after = await rewardManager.totalStakedPrice();
      expect(after.toString()).to.equal(before.sub(secondPrice).toString());
    });
  });

  describe('#updateStake()', function(){
    const originalDeposit = BigNumber.from(1234);
    const depositAmount = BigNumber.from(1000);
    const originalStake = BigNumber.from(10000);
    const secondPrice = BigNumber.from(10);
    beforeEach(async function(){
      await rewardManager.connect(owner).deposit({value:originalDeposit});
      await rewardManager.connect(stakeManager).addStakes(await user.getAddress(), originalStake);
      await rewardManager.connect(owner).deposit({value:depositAmount});
    });

    it("should not add deposit before stake", async function(){
      await rewardManager.connect(accounts[7]).updateStake(await user.getAddress());
      const after = await rewardManager.balanceOf(await user.getAddress());
      expect(after.toString()).to.equal(depositAmount.toString());
    });
  });
});
