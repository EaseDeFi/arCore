import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
describe("BalanceManager", function () {
  let accounts: Signer[];
  let balanceManager: Contract;
  let planManager: Signer;
  let user: Signer;
  beforeEach(async function () {
    const BalanceFactory = await ethers.getContractFactory("BalanceManager");
    accounts = await ethers.getSigners();
    planManager = accounts[4];
    user = accounts[3];
    balanceManager = await BalanceFactory.deploy();
  });

  describe("#deposit()", function () {
    const amount = ethers.BigNumber.from("1000000");
    it("should update balance", async function(){
      await balanceManager.connect(user).deposit({value:amount});
      expect('updateBalance').to.be.calledOnContract(balanceManager);
    });
    it("should be able to deposit ether", async function (){
      await balanceManager.connect(user).deposit({value:amount});
    });

    it("should update balance of msg.sender", async function (){
      const balanceBefore = (await balanceManager.balances(user.getAddress())).lastBalance;
      await balanceManager.connect(user).deposit({value:amount});
      const balanceAfter = (await balanceManager.balances(user.getAddress())).lastBalance;
      expect(balanceAfter.toString()).to.equal(balanceBefore.add(amount).toString());
    });

    it("should emit Deposit Event", async function (){
      // don't know how to make this work :(
      await expect(balanceManager.connect(user).deposit({value:amount})).to.emit(balanceManager, 'Deposit').withArgs((await user.getAddress()), amount.toString());
    });
  });

  describe("#withdraw()", function () {
    const amount = ethers.BigNumber.from("1000000");
    beforeEach(async function (){
      await balanceManager.connect(user).deposit({value:amount});
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
  });

  describe("#changePrice()", function () {
    const newPrice = ethers.BigNumber.from("10000");
    it("should fail if msg.sender is not plan manager", async function(){
      await balanceManager.initialize(await planManager.getAddress());
      await expect(balanceManager.connect(user).changePrice(await user.getAddress(),newPrice)).to.be.reverted;
    });
    it("should update perSecondPrice when updated", async function(){
      await balanceManager.initialize(await planManager.getAddress());
      await balanceManager.connect(planManager).changePrice(await user.getAddress(),newPrice);
      const price = (await balanceManager.balances(user.getAddress())).perSecondPrice;
      expect(price.toString()).to.equal(newPrice.toString());
    });
  });
});
