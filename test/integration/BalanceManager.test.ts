import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { increase } from "../utils";
import { ArmorCore } from "./ArmorCore";
describe("BalanceManager", function () {
  let accounts: Signer[];
  let token: Contract;
  let armor: ArmorCore;
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
    
    const TokenFactory = await ethers.getContractFactory("ArmorToken");
    token = await TokenFactory.deploy();

    armor = new ArmorCore(owner);
    await armor.deploy(token);
  });
  describe("#deposit()", function () {
    const amount = ethers.BigNumber.from("1000000");
    it('should fail if msg.value is zero', async function(){
      await expect(armor.balanceManager.connect(user).deposit(await referrer.getAddress())).to.be.revertedWith("No Ether was deposited");
    });
    it("should be able to deposit ether", async function (){
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
    });

    it("should update balance of msg.sender", async function (){
      const balanceBefore = (await armor.balanceManager.balances(user.getAddress())).lastBalance;
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      const balanceAfter = (await armor.balanceManager.balances(user.getAddress())).lastBalance;
      expect(balanceAfter.toString()).to.equal(balanceBefore.add(amount).toString());
    });

    it("should be able to deposit when uf is off", async function(){
      const newPrice = ethers.BigNumber.from("10000");
      await armor.setPrice(armor.balanceManager, newPrice);
      await increase(100);
      await armor.balanceManager.connect(owner).toggleUF();
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      await increase(86400);
      await armor.balanceManager.connect(user).withdraw(amount);
    });

    it("should emit Deposit Event", async function (){
      await expect(armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount})).to.emit(armor.balanceManager, 'Deposit').withArgs((await user.getAddress()), amount.toString());
    });
  });
  describe("#withdraw()", function () {
    const amount = ethers.BigNumber.from("1000000");
    beforeEach(async function (){
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      await increase(3600);
    });

    it("should fail if called twice in an hour", async function(){
      await armor.balanceManager.connect(user).withdraw(1);
      await expect(armor.balanceManager.connect(user).withdraw(1)).to.be.revertedWith("You must wait an hour after your last update to withdraw.");
    });
    it("should return balance if amount is larger than balance", async function (){
      await expect(armor.balanceManager.connect(user).withdraw(amount.add(1)));
      let balance = await armor.balanceManager.balanceOf(user.getAddress());
      expect(balance.toString()).to.equal("0");
    });
    it("should decrease user balance", async function (){
      const balanceBefore = (await armor.balanceManager.balances(user.getAddress())).lastBalance;
      await armor.balanceManager.connect(user).withdraw(amount);
      const balanceAfter = (await armor.balanceManager.balances(user.getAddress())).lastBalance;
      expect(balanceAfter.toString()).to.equal(balanceBefore.sub(amount).toString());
    });
    it("should send ether to msg.sender", async function (){
      const balanceBefore = (await armor.balanceManager.balances(user.getAddress())).lastBalance;
      await armor.balanceManager.connect(user).withdraw(amount);
      const balanceAfter = (await armor.balanceManager.balances(user.getAddress())).lastBalance;
    });

    it("should emit Withdraw event", async function (){
      await expect(armor.balanceManager.connect(user).withdraw(amount)).to.emit(armor.balanceManager, 'Withdraw').withArgs((await user.getAddress()), amount.toString());
    });
  });
  
  describe.skip("#expiry", function () {
    const amount = ethers.BigNumber.from("10000000000000000");

    it("should expire when balance reaches 0", async function (){
    });

    it("should delete balance price on expiry", async function (){
    });
  });
});
