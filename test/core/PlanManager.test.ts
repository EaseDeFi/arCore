import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { OrderedMerkleTree } from "../utils/Merkle";
import { increase, getTimestamp } from "../utils";
function encodeProtocol(protocol: string, amount: BigNumber) {
  const abiCoder = new ethers.utils.AbiCoder();
  return ethers.utils.keccak256(abiCoder.encode(["address", "uint256"],[protocol, amount]));
}

describe("PlanManager", function () {
  let accounts: Signer[];
  let planManager: Contract;
  //mock
  let balanceManager: Contract;
  let stakeManager: Contract;
  //signer instead of mock
  let claimManager: Signer;
  //accounts settings
  let user: Signer;
  let unknownUser: Signer;
  const coverAmount = BigNumber.from(100);
  const price = BigNumber.from(1); // this means 1 wei per second
  const userBalance = BigNumber.from(1000000);
  beforeEach(async function () {
    //account setting
    accounts = await ethers.getSigners();
    user = accounts[4];
    unknownUser = accounts[9];

    const BalanceFactory = await ethers.getContractFactory("BalanceManagerMock");
    const StakeFactory = await ethers.getContractFactory("StakeManagerMock");
    const PlanFactory = await ethers.getContractFactory("PlanManager");

    //mock contracts
    balanceManager = await BalanceFactory.deploy();
    stakeManager = await StakeFactory.deploy();
    claimManager = accounts[2];
    const claimManagerAddress = await claimManager.getAddress();

    planManager = await PlanFactory.deploy();
    await planManager.initialize(stakeManager.address, balanceManager.address, claimManagerAddress);
    //mock setting
    await stakeManager.mockSetPlanManager(planManager.address);

  });

  describe("#initialize()", function() {
    it("should fail if already initialized", async function(){
      await expect(planManager.initialize(stakeManager.address, balanceManager.address, await claimManager.getAddress())).to.be.revertedWith("Contract already initialized");
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

    it("should fail if given old values does not match the stored value", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(10));
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      await expect(planManager.connect(user).updatePlan([balanceManager.address],[coverAmount.add(1)],[balanceManager.address], [coverAmount])).to.be.revertedWith("Merkle Root from provided values are not correct");
    });
    
    it("should fail if parameter length is different", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount);
      await expect(planManager.updatePlan([],[],[balanceManager.address],[coverAmount, coverAmount.add(price)])).to.be.revertedWith("protocol and coverAmount length mismatch");
    });
    
    it("should fail if protocol's nft price is zero", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount);
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, 0);
      await expect(planManager.updatePlan([],[],[balanceManager.address],[coverAmount])).to.be.revertedWith("Protocol price is zero");
    });
    
    it("should fail if exceeds protocol limit", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.sub(price));
      await expect(planManager.updatePlan([],[],[balanceManager.address], [coverAmount])).to.be.revertedWith("Exceeds total cover amount");
    });
    
    it("should update plan", async function(){
      const protocolHashed = encodeProtocol(balanceManager.address, coverAmount);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.add(price));
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      const plan = await planManager.getCurrentPlan(await user.getAddress());
      const merkle = new OrderedMerkleTree([plan.root]);
      expect(plan.root).to.equal(merkle.calculateRoot());
    });

    it("should increase totalUsedCover", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.add(price));
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      expect((await planManager.totalUsedCover(balanceManager.address)).toString()).to.equal(coverAmount.toString());
    });

    it("should return true for checkCoverage", async function(){
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.mul(1000));
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      const protocolHashed = encodeProtocol(balanceManager.address, coverAmount);
      const plan = await planManager.getCurrentPlan(await user.getAddress());
      const merkle = new OrderedMerkleTree([plan.root]);
      const path = merkle.getPath(0);
      await increase(10000);
      await planManager.connect(user).updatePlan([balanceManager.address],[coverAmount],[balanceManager.address], [coverAmount]);
      expect((await planManager.checkCoverage(await user.getAddress(), balanceManager.address, plan.end.sub(price), coverAmount, path)).check).to.equal(true);
      expect((await planManager.checkCoverage(await unknownUser.getAddress(), balanceManager.address, plan.end.sub(price), coverAmount, path)).check).to.equal(false);
    });

    it("should be able to update when there is currenct plan", async function(){
      await stakeManager.mockSetPlanManagerPrice(stakeManager.address, price);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount);
      await stakeManager.mockLimitSetter(stakeManager.address, coverAmount);
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      await planManager.connect(user).updatePlan([balanceManager.address],[coverAmount],[balanceManager.address, stakeManager.address,], [coverAmount, coverAmount.sub(price)]);
    });
  });

  describe('#updateExpireTime()', function(){
    it('should fail if msg.sender is not balance manager', async function(){
      await expect(planManager.connect(user).updateExpireTime(await user.getAddress())).to.be.revertedWith("Only BalanceManager can call this function");
    });

    it('should do nothing if user does not have any plan', async function(){
      await balanceManager.updateExpireTime(planManager.address, await user.getAddress());
    });
    
    it('should do nothing if plan is already expired', async function(){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      const protocolHashed = encodeProtocol(balanceManager.address, coverAmount);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.add(price));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      await increase(userBalance.add(1000).toNumber());
      await balanceManager.updateExpireTime(planManager.address, await user.getAddress());
    });
    
    it('should update expiretime when there is active plan', async function(){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      const protocolHashed = encodeProtocol(balanceManager.address, coverAmount);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.add(price));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      await balanceManager.updateExpireTime(planManager.address, await user.getAddress());
    });
  });

  describe('#planRedeemed()', function(){
    beforeEach(async function(){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      const protocolHashed = encodeProtocol(balanceManager.address, coverAmount);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.add(price));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
    });
    it('should fail if msg.sender is not claimmanger', async function(){
      await expect(planManager.connect(user).planRedeemed(await user.getAddress(), 0, balanceManager.address)).to.be.revertedWith("Only ClaimManager can call this function");
    });
    
    it('should fail if target plan is currently activated', async function(){
      await expect(planManager.connect(claimManager).planRedeemed(await user.getAddress(), 0, balanceManager.address)).to.be.revertedWith("Cannot redeem active plan, update plan to redeem properly");
    });

    it('should change claim status to true', async function(){
      await increase(userBalance.add(1000).toNumber());
      await planManager.connect(claimManager).planRedeemed(await user.getAddress(), 0, balanceManager.address);
    });
  });

  describe('#getCurrentPlan()', function(){
    it('should return zeros when expired or empty', async function(){
      const empty = await planManager.getCurrentPlan(await user.getAddress());
      expect(empty[0]).to.be.equal(0);
      expect(empty[1]).to.be.equal(0);
      //expect(empty[2]).to.be.equal(0);
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      const protocolHashed = encodeProtocol(balanceManager.address, coverAmount);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.add(price));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      await increase(userBalance.add(1000).toNumber());
      const expired = await planManager.getCurrentPlan(await user.getAddress());
      expect(expired[0]).to.be.equal(0);
      expect(expired[1]).to.be.equal(0);
      //expect(expired[2]).to.be.equal(0);
    });
    it('should return appropriate values if active', async function(){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      const protocolHashed = encodeProtocol(balanceManager.address, coverAmount);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.add(price));
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      await increase(userBalance.add(1000).toNumber());
      await planManager.getCurrentPlan(await user.getAddress());
    });
  });
});
