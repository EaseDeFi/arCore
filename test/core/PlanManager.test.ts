import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { OrderedMerkleTree } from "../utils/Merkle";
import { increase, getTimestamp, mine } from "../utils";
function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}

describe("PlanManager", function () {
  let accounts: Signer[];
  let planManager: Contract;
  let master: Contract;
  //mock
  let balanceManager: Contract;
  let stakeManager: Contract;
  //signer instead of mock
  let claimManager: Signer;
  //accounts settings
  let owner: Signer;
  let user: Signer;
  let unknownUser: Signer;
  const coverAmount = BigNumber.from("1000000000000000000");
  const price = BigNumber.from("10000000000000"); // this means 0.00001 eth per second
  const userBalance = BigNumber.from("100000000000000000000");
  beforeEach(async function () {
    //account setting
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[3];
    unknownUser = accounts[9];
    
    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    master = await MasterFactory.deploy();
    await master.connect(owner).initialize();

    const BalanceFactory = await ethers.getContractFactory("BalanceManagerMock");
    balanceManager = await BalanceFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("BALANCE"), balanceManager.address);
    const StakeFactory = await ethers.getContractFactory("StakeManagerMock");
    stakeManager = await StakeFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("STAKE"), stakeManager.address);

    const PlanFactory = await ethers.getContractFactory("PlanManager");
    planManager = await PlanFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("PLAN"), planManager.address);

    //mock contracts
    claimManager = accounts[2];
    const claimManagerAddress = await claimManager.getAddress();
    await master.connect(owner).registerModule(stringToBytes32("CLAIM"), claimManagerAddress);

    await planManager.connect(owner).initialize(master.address);
    //mock setting
    await stakeManager.connect(owner).mockSetPlanManager(planManager.address);
    await stakeManager.connect(owner).allowProtocol(balanceManager.address, true);
  });

  describe("#initialize()", function() {
    it("should fail if already initialized", async function(){
      await expect(planManager.initialize(master.address)).to.be.revertedWith("already initialized");
    });
  });

  describe("#changePrice()", function () {
    it("should fail if msg.sender is not stakeManager", async function(){
      await expect(planManager.connect(user).changePrice(balanceManager.address, price)).to.be.reverted;
    });

    it("should set new price", async function(){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      const nftPrice = await planManager.nftCoverPrice(balanceManager.address);
      expect(nftPrice.toString()).to.equal(price.toString());
    });
  });

  describe("#updatePlan()", function () {
    beforeEach(async function (){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
    });

    it("should fail if parameter length is different", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await expect(planManager.updatePlan([balanceManager.address],[coverAmount, coverAmount.add(price)])).to.be.revertedWith("protocol and coverAmount length mismatch");
    });
    
    it("should fail if protocol's nft price is zero", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, 0);
      await expect(planManager.updatePlan([balanceManager.address],[coverAmount])).to.be.revertedWith("Protocol price is zero");
    });
    
    it("should fail if exceeds protocol limit", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.sub(price));
      await expect(planManager.updatePlan([balanceManager.address], [coverAmount])).to.be.revertedWith("Exceeds allowed cover amount.");
    });
    
    it("should update plan", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
      const plan = await planManager.getCurrentPlan(await user.getAddress());
      const merkle = new OrderedMerkleTree([plan.root]);
      expect(plan.root).to.equal(merkle.calculateRoot());
    });

    it("should increase totalUsedCover", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
      expect((await planManager.totalUsedCover(balanceManager.address)).toString()).to.equal(coverAmount.toString());
    });

    it("should return true for checkCoverage", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(1000));
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
      const plan = await planManager.getCurrentPlan(await user.getAddress());
      const merkle = new OrderedMerkleTree([plan.root]);
      const path = merkle.getPath(0);
      await increase(10000);
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
      expect((await planManager.checkCoverage(await user.getAddress(), balanceManager.address, plan.end.sub(1), coverAmount, path)).check).to.equal(true);
      expect((await planManager.checkCoverage(await unknownUser.getAddress(), balanceManager.address, plan.end.sub(1), coverAmount, path)).check).to.equal(false);
    });

    it("should be able to update when there is currenct plan", async function(){
      await stakeManager.mockSetPlanManagerPrice(stakeManager.address, price);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await stakeManager.mockLimitSetter(stakeManager.address, coverAmount.mul(10));
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
      await planManager.connect(user).updatePlan([balanceManager.address, stakeManager.address,], [coverAmount, coverAmount.sub(price)]);
    });
  });

  describe('#updateExpireTime()', function(){
    it('should fail if msg.sender is not balance manager', async function(){
      await expect(planManager.connect(user).updateExpireTime(await user.getAddress(), 1700000000)).to.be.revertedWith("only module BALANCE can call this function");
    });

    it('should do nothing if user does not have any plan', async function(){
      await balanceManager.updateExpireTime(planManager.address, await user.getAddress(), 0);
    });
    
    it('should do nothing if plan is already expired', async function(){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
      const plan = await planManager.getCurrentPlan(await user.getAddress());
      await increase(plan.end.add(1000).toNumber());
      await balanceManager.updateExpireTime(planManager.address, await user.getAddress(), 0);
    });
    
    it('should update expiretime when there is active plan', async function(){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
      await balanceManager.updateExpireTime(planManager.address, await user.getAddress(), 0);
    });

    it('should correctly remove latest totals if needed', async function(){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
      await balanceManager.updateExpireTime(planManager.address, await user.getAddress(), 0);
      let updated = await planManager.totalUsedCover(balanceManager.address);
      expect(updated.toString()).to.be.equal('0')
    });

  });

  describe('#planRedeemed()', function(){
    beforeEach(async function(){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
    });
    it('should fail if msg.sender is not claimmanger', async function(){
      await expect(planManager.connect(user).planRedeemed(await user.getAddress(), 0, balanceManager.address)).to.be.revertedWith("only module CLAIM can call this function");
    });
    
    it('should fail if target plan is currently activated', async function(){
      await expect(planManager.connect(claimManager).planRedeemed(await user.getAddress(), 0, balanceManager.address)).to.be.revertedWith("Cannot redeem active plan, update plan to redeem properly");
    });

    it('should change claim status to true', async function(){
      const plan = await planManager.getCurrentPlan(await user.getAddress());
      await increase(plan.end.add(1000).toNumber());
      await planManager.connect(claimManager).planRedeemed(await user.getAddress(), 0, balanceManager.address);
    });
  });

  describe('#getCurrentPlan()', function(){
    it('should return zeros when expired or empty', async function(){
      const empty = await planManager.getCurrentPlan(await user.getAddress());
      expect(empty[1]).to.be.equal(0);
      expect(empty[2]).to.be.equal(0);
      //expect(empty[2]).to.be.equal(0);
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
      const plan = await planManager.getCurrentPlan(await user.getAddress());
      await increase(plan.end.add(1000).toNumber());
      await mine();
      const expired = await planManager.getCurrentPlan(await user.getAddress());
      expect(expired[1]).to.be.equal(0);
      expect(expired[2]).to.be.equal(0);
      //expect(expired[2]).to.be.equal(0);
    });
    it('should return appropriate values if active', async function(){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([balanceManager.address], [coverAmount]);
      const plan = await planManager.getCurrentPlan(await user.getAddress());
      await increase(plan.end.add(1000).toNumber());
      await planManager.getCurrentPlan(await user.getAddress());
    });
  });
});
