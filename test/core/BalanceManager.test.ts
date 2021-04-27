import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { increase } from "../utils";
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
  let utilizationFarm: Contract;
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
    await balanceManager.changeRefPercent(25);
    await balanceManager.changeDevPercent(25);
    await balanceManager.changeGovPercent(25);
    await master.connect(owner).registerModule(stringToBytes32("BALANCE"), balanceManager.address);
    await master.connect(owner).addJob(stringToBytes32("BALANCE"));

    const PlanFactory = await ethers.getContractFactory("PlanManagerMock");
    planManager = await PlanFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("PLAN"), planManager.address);
    
    const TokenFactory = await ethers.getContractFactory("ArmorToken");
    token = await TokenFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("ARMOR"), token.address);
    
    const RewardFactory = await ethers.getContractFactory("RewardManager");
    rewardManager = await RewardFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("REWARD"), rewardManager.address);

    const GovernanceStakerFactory = await ethers.getContractFactory("GovernanceStaker");
    governanceStaker = await GovernanceStakerFactory.deploy(token.address, constants.AddressZero, master.address);
    await governanceStaker.setRewardDistribution(balanceManager.address);
    await master.connect(owner).registerModule(stringToBytes32("GOVSTAKE"), governanceStaker.address);
    await rewardManager.initialize(master.address, constants.AddressZero);

    const UtilizationFarm = await ethers.getContractFactory("UtilizationFarm");
    utilizationFarm = await UtilizationFarm.deploy();
    await utilizationFarm.initialize(token.address, master.address);
    await master.connect(owner).registerModule(stringToBytes32("UFB"), utilizationFarm.address);
  });

  describe("#initialize()", function() {
    it("should fail if already initialized", async function(){
      await expect(balanceManager.connect(user).initialize(master.address, await dev.getAddress())).to.be.revertedWith("already initialized");
    });
  });

  describe("#deposit()", function () {
    const amount = ethers.BigNumber.from("1000000");
    it('should fail if msg.value is zero', async function(){
      await expect(balanceManager.connect(user).deposit(await referrer.getAddress())).to.be.revertedWith("No Ether was deposited");
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

    it("should be able to deposit when uf is off", async function(){
      const newPrice = ethers.BigNumber.from("10000");
      await planManager.mockChangePrice(balanceManager.address, user.getAddress(), newPrice);
      await increase(100);
      await balanceManager.connect(owner).toggleUF();
      await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      await increase(86400);
      await balanceManager.connect(user).withdraw(amount);
    });

    it("should emit Deposit Event", async function (){
      await expect(balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount})).to.emit(balanceManager, 'Deposit').withArgs((await user.getAddress()), amount.toString());
    });
  });

  describe("#withdraw()", function () {
    const amount = ethers.BigNumber.from("1000000");
    beforeEach(async function (){
      await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      await increase(3600);
    });

    it("should fail if called twice in an hour", async function(){
      await balanceManager.connect(user).withdraw(1);
      await expect(balanceManager.connect(user).withdraw(1)).to.be.revertedWith("You must wait an hour after your last update to withdraw.");
    });
    it("should return balance if amount is larger than balance", async function (){
      await expect(balanceManager.connect(user).withdraw(amount.add(1)));
      let balance = await balanceManager.balanceOf(user.getAddress());
      expect(balance.toString()).to.equal("0");
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
      const viewer = await balanceManager.perSecondPrice(user.getAddress());
      expect(price.toString()).to.equal(newPrice.toString());
    });
  });

  describe("#expiry", function () {
    const amount = ethers.BigNumber.from("10000000000000000");

    it("should expire when balance reaches 0", async function (){
      // Set multiple balances so linked list has contents before and after user.
      await balanceManager.connect(dev).deposit(await referrer.getAddress(), {value:amount});
      await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      await balanceManager.connect(referrer).deposit(await referrer.getAddress(), {value:amount});

      // Change price so it runs out. Referrer runs out first, then user, then dev.
      await planManager.mockChangePrice(balanceManager.address, await user.getAddress(),amount.div(1000));
      await planManager.mockChangePrice(balanceManager.address, await dev.getAddress(),amount.div(10000));
      await planManager.mockChangePrice(balanceManager.address, await referrer.getAddress(),amount.div(100000));

      await increase(86400);
      // Connect from owner to trigger keep()
      await balanceManager.connect(owner).expireBalance(await user.getAddress());
      await balanceManager.connect(owner).expireBalance(await dev.getAddress());

      let info = await balanceManager.infos(user.getAddress());
      expect(info.toString()).to.equal("0,0,0");
      info = await balanceManager.infos(dev.getAddress());
      expect(info.toString()).to.equal("0,0,0");
      info = await balanceManager.infos(referrer.getAddress());
      expect(info[2].toString()).to.not.equal("0")
    });

    it("should delete balance price on expiry", async function (){
      await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
      await planManager.mockChangePrice(balanceManager.address, await user.getAddress(),amount.div(1000));
      await increase(86400);
      await balanceManager.connect(owner).expireBalance(await user.getAddress());
      let balance = await balanceManager.balances(user.getAddress())
      expect(balance[1].toString()).to.be.equal('0');
    });
  });

  describe("#operation functions", function() {
    const amount = ethers.BigNumber.from("1000000000000000000");
    it("percent setters cannot set more than Denominator", async function(){
      await expect(balanceManager.connect(owner).changeDevPercent(10001)).to.be.reverted;
      await expect(balanceManager.connect(owner).changeRefPercent(10001)).to.be.reverted;
      await expect(balanceManager.connect(owner).changeGovPercent(10001)).to.be.reverted;
    });

    describe("releaseFund", async function(){
      it('should not release if fund is not enough', async function(){
        await balanceManager.connect(dev).deposit(await referrer.getAddress(), {value:amount});
        await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
        await balanceManager.connect(referrer).deposit(await referrer.getAddress(), {value:amount});

        // Change price so it runs out. Referrer runs out first, then user, then dev.
        await planManager.mockChangePrice(balanceManager.address, await user.getAddress(),amount.div(1000));
        await planManager.mockChangePrice(balanceManager.address, await dev.getAddress(),amount.div(1000));
        await planManager.mockChangePrice(balanceManager.address, await referrer.getAddress(),amount.div(1000));

        await increase(86400);
        // Connect from owner to trigger keep()
        await balanceManager.connect(owner).deposit(await referrer.getAddress(), {value:amount});
        await balanceManager.connect(owner).releaseFunds();
      });
      
      it('should release if fund is enough', async function(){
        await balanceManager.connect(dev).deposit(await referrer.getAddress(), {value:amount});
        await balanceManager.connect(user).deposit(await referrer.getAddress(), {value:amount});
        await balanceManager.connect(referrer).deposit(await referrer.getAddress(), {value:amount});

        await balanceManager.connect(owner).changeDevPercent(0);
        await balanceManager.connect(owner).changeRefPercent(500);
        await balanceManager.connect(owner).changeGovPercent(500);
        
        // Change price so it runs out. Referrer runs out first, then user, then dev.
        await planManager.mockChangePrice(balanceManager.address, await user.getAddress(),amount.div(1000));
        await planManager.mockChangePrice(balanceManager.address, await dev.getAddress(),amount.div(1000));
        await planManager.mockChangePrice(balanceManager.address, await referrer.getAddress(),amount.div(1000));

        await increase(86400);
        // Connect from owner to trigger keep()
        await balanceManager.connect(owner).deposit(await referrer.getAddress(), {value:amount});
        await balanceManager.connect(owner).releaseFunds();
      });
    });

    it("toggleShield", async function(){
      await balanceManager.toggleShield(owner.getAddress());
    })
  });
});
