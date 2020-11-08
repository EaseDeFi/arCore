import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { OrderedMerkleTree } from "../utils/Merkle";
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
  let claimManager: Contract;
  //accounts settings
  let user: Signer;
  beforeEach(async function () {
    const BalanceFactory = await ethers.getContractFactory("BalanceManagerMock");
    const StakeFactory = await ethers.getContractFactory("StakeManagerMock");
    const ClaimFactory = await ethers.getContractFactory("ClaimManagerMock");
    const PlanFactory = await ethers.getContractFactory("PlanManager");

    //mock contracts
    balanceManager = await BalanceFactory.deploy();
    stakeManager = await StakeFactory.deploy();
    claimManager = await ClaimFactory.deploy();

    planManager = await PlanFactory.deploy();
    await planManager.initialize(stakeManager.address, balanceManager.address, claimManager.address);
    //mock setting
    await stakeManager.mockSetPlanManager(planManager.address);

    //account setting
    accounts = await ethers.getSigners();
    user = accounts[4];
  });

  describe("#changePrice()", function () {
    const price = BigNumber.from(1); // this means 1 wei per second
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
    const price = BigNumber.from(1); // this means 1 wei per second
    const coverAmount = BigNumber.from(100);
    const userBalance = BigNumber.from(1000000);
    beforeEach(async function (){
      await stakeManager.mockSetPlanManagerPrice(balanceManager.address, price);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
    });
    
    it("should fail if parameter length is different", async function(){
      await expect(planManager.updatePlan([],[],[balanceManager.address],[coverAmount, coverAmount.add(price)])).to.be.revertedWith("Input array lengths do not match.");
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
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount.add(price));
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      const protocolHashed = encodeProtocol(balanceManager.address, coverAmount);
      const plan = await planManager.getCurrentPlan(await user.getAddress());
      const merkle = new OrderedMerkleTree([plan.root]);
      const path = merkle.getPath(0);
      expect((await planManager.checkCoverage(await user.getAddress(), balanceManager.address, plan.end.sub(price), coverAmount, path)).check).to.equal(true);
    });

    it("should be able to update when there is currenct plan", async function(){
      await stakeManager.mockSetPlanManagerPrice(stakeManager.address, price);
      await stakeManager.mockLimitSetter(balanceManager.address, coverAmount);
      await stakeManager.mockLimitSetter(stakeManager.address, coverAmount);
      await planManager.connect(user).updatePlan([],[],[balanceManager.address], [coverAmount]);
      await planManager.connect(user).updatePlan([balanceManager.address],[coverAmount],[balanceManager.address, stakeManager.address,], [coverAmount, coverAmount.sub(price)]);
    });
  });
});
