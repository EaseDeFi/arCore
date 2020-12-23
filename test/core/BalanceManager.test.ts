import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";

function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}
describe("BalanceManager", function () {
  let accounts: Signer[];
  let master: Contract;
  let balanceManager: Contract;
  let planManager: Contract;
  let rewardManager: Contract;
  let governanceStaker: Contract;
  let token: Contract;
  let owner: Signer;
  let user: Signer;
  let dev: Signer;
  let referrer: Signer;
  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[3];
    dev = accounts[4];
    referrer = accounts[5];
    
    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    master = await MasterFactory.deploy();
    await master.connect(owner).initialize();

    const BalanceFactory = await ethers.getContractFactory("BalanceManager");
    balanceManager = await BalanceFactory.deploy();
    await balanceManager.initialize(master.address, await dev.getAddress());
    await master.connect(owner).registerModule(stringToBytes32("BALANCE"), balanceManager.address);

    const PlanFactory = await ethers.getContractFactory("PlanManagerMock");
    planManager = await PlanFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("PLAN"), planManager.address);
    
    const TokenFactory = await ethers.getContractFactory("ArmorToken");
    token = await TokenFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("ARMOR"), planManager.address);
    
    const RewardFactory = await ethers.getContractFactory("RewardManager");
    rewardManager = await RewardFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("REWARD"), planManager.address);

    const GovernanceStakerFactory = await ethers.getContractFactory("GovernanceStaker");
    governanceStaker = await GovernanceStakerFactory.deploy(token.address, constants.AddressZero);
    await rewardManager.initialize(master.address, await user.getAddress(), balanceManager.address);
  });

  describe.skip("#initialize()", function() {
    it("should fail if already initialized", async function(){
      await expect(balanceManager.connect(user).initialize(planManager.address, governanceStaker.address, rewardManager.address, await dev.getAddress())).to.be.revertedWith("Contract already initialized");
    });
  });

  describe("#deposit()", function () {
    const amount = ethers.BigNumber.from("1000000");
    it('should fail if msg.value is zero', async function(){
      await expect(balanceManager.connect(user).deposit(await referrer.getAddress())).to.be.revertedWith("No Ether was deposited");
    });
    it("should update balance", async function(){
      await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      expect('updateBalance').to.be.calledOnContract(balanceManager);
    });
    it("should be able to deposit ether", async function (){
      await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
    });

    it("should update balance of msg.sender", async function (){
      const balanceBefore = (await balanceManager.balances(user.getAddress())).lastBalance;
      await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      const balanceAfter = (await balanceManager.balances(user.getAddress())).lastBalance;
      expect(balanceAfter.toString()).to.equal(balanceBefore.add(amount).toString());
    });

    it("should emit Deposit Event", async function (){
      await expect(balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount})).to.emit(balanceManager, 'Deposit').withArgs((await user.getAddress()), amount.toString());
    });
  });

  describe("#withdraw()", function () {
    const amount = ethers.BigNumber.from("1000000");
    beforeEach(async function (){
      await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
    });
    it("should update balance", async function(){
      await balanceManager.connect(user).withdraw(amount);
      expect('updateBalance').to.be.calledOnContract(balanceManager);
    });
    it("should fail if amount is larger than balance", async function (){
      await expect(balanceManager.connect(user).withdraw(amount.add(1))).to.be.reverted;
    });
    it("should decrease user balance", async function (){
      const balanceBefore = (await balanceManager.balances(user.getAddress())).lastBalance;
      await balanceManager.connect(user).withdraw(amount);
      const balanceAfter = (await balanceManager.balances(user.getAddress())).lastBalance;
      expect(balanceAfter.toString()).to.equal(balanceBefore.sub(amount).toString());
    });
    it("should send ether to msg.sender", async function (){
      const balanceBefore = (await balanceManager.balances(user.getAddress())).lastBalance;
      await balanceManager.connect(user).withdraw(amount);
      const balanceAfter = (await balanceManager.balances(user.getAddress())).lastBalance;
    });

    it("should emit Withdraw event", async function (){
      await expect(balanceManager.connect(user).withdraw(amount)).to.emit(balanceManager, 'Withdraw').withArgs((await user.getAddress()), amount.toString());
    });
  });

  describe("#changePrice()", function () {
    const newPrice = ethers.BigNumber.from("10000");
    it("should fail if msg.sender is not plan manager", async function(){
      await expect(balanceManager.connect(user).changePrice(await user.getAddress(),newPrice)).to.be.reverted;
    });
    it("should update perSecondPrice when updated", async function(){
      await planManager.mockChangePrice(balanceManager.address, await user.getAddress(),newPrice);
      const price = (await balanceManager.balances(user.getAddress())).perSecondPrice;
      expect(price.toString()).to.equal(newPrice.toString());
    });
  });
});
