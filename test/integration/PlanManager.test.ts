import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { OrderedMerkleTree } from "../utils/Merkle";
import { increase, getTimestamp, mine } from "../utils";
import { ArmorCore } from "./ArmorCore";
function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}

const ETHER  = BigNumber.from("1000000000000000000");

describe("PlanManager", function () {
  //signer instead of mock
  //let claimManager: Signer;
  //accounts settings
  const coverAmount = BigNumber.from("1");
  const price = BigNumber.from("10000000000000"); // this means 0.00001 eth per second
  const userBalance = price.mul(86400*100);
  
  let accounts: Signer[];
  let token: Contract;
  let armor: ArmorCore;
  let owner: Signer;
  let user: Signer;
  let dev: Signer;
  let referrer: Signer;
  let unknownUser: Signer;
  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[3];
    dev = accounts[4];
    referrer = accounts[5];
    unknownUser = accounts[6];
    
    const TokenFactory = await ethers.getContractFactory("ArmorToken");
    token = await TokenFactory.deploy();

    armor = new ArmorCore(owner);
    await armor.deploy(token);
  });

  describe("#changePrice()", function () {
    it("should fail if msg.sender is not stakeManager", async function(){
      await expect(armor.planManager.connect(user).changePrice(armor.balanceManager.address, price)).to.be.reverted;
    });

    it("should set new price", async function(){
      await armor.increaseStake(armor.balanceManager, coverAmount.mul(10));
      await armor.increaseStake(armor.stakeManager, coverAmount.mul(10));
      await armor.setPrice(armor.stakeManager, price);
      await armor.setPrice(armor.balanceManager, price);
      const nftPrice = await armor.planManager.nftCoverPrice(armor.balanceManager.address);
      expect(nftPrice.toString()).to.equal(price.toString());
    });
  });

  describe("#updatePlan()", function () {
    beforeEach(async function (){
      await armor.increaseStake(armor.balanceManager, coverAmount.mul(10));
      await armor.increaseStake(armor.stakeManager, coverAmount.mul(10));
      await armor.setPrice(armor.stakeManager, price);
      await armor.setPrice(armor.balanceManager, price);
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:userBalance});
    });

    it("should fail if parameter length is different", async function(){
      await expect(armor.planManager.updatePlan([armor.balanceManager.address],[coverAmount.mul(ETHER), coverAmount.mul(ETHER).add(price)])).to.be.revertedWith("protocol and coverAmount length mismatch");
    });
    
    it("should fail if protocol's nft price is zero", async function(){
      await armor.setPrice(armor.balanceManager, BigNumber.from(0));
      await expect(armor.planManager.updatePlan([armor.balanceManager.address],[coverAmount.mul(ETHER)])).to.be.revertedWith("Protocol price is zero");
    });
    
    it("should fail if exceeds protocol limit", async function(){
      await expect(armor.planManager.updatePlan([armor.balanceManager.address], [coverAmount.mul(20).mul(ETHER)])).to.be.revertedWith("Exceeds allowed cover amount.");
    });
    
    it("should update plan", async function(){
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
      const plan = await armor.planManager.getCurrentPlan(await user.getAddress());
    });

    it("should increase totalUsedCover", async function(){
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
      expect((await armor.planManager.totalUsedCover(armor.balanceManager.address)).toString()).to.equal(coverAmount.mul(ETHER).toString());
    });

    it("should return true for checkCoverage", async function(){
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
      const plan = await armor.planManager.getCurrentPlan(await user.getAddress());
      await increase(10000);
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
      expect((await armor.planManager.checkCoverage(await user.getAddress(), armor.balanceManager.address, plan.end.sub(1), coverAmount.mul(ETHER))).check).to.equal(true);
      expect((await armor.planManager.checkCoverage(await unknownUser.getAddress(), armor.balanceManager.address, plan.end.sub(1), coverAmount.mul(ETHER))).check).to.equal(false);
    });

    it("should be able to update when there is currenct plan", async function(){
      await armor.setPrice(armor.stakeManager, price);
      await armor.setPrice(armor.balanceManager, price);
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address, armor.stakeManager.address,], [coverAmount.mul(ETHER), coverAmount.mul(ETHER).sub(price)]);
    });
  });

  describe('#updateExpireTime()', function(){
    it('should fail if msg.sender is not balance manager', async function(){
      await expect(armor.planManager.connect(user).updateExpireTime(await user.getAddress(), 1700000000)).to.be.revertedWith("only module BALANCE can call this function");
    });

    it.skip('should do nothing if user does not have any plan', async function(){
      //await armorbalanceManager.updateExpireTime(planManager.address, await user.getAddress(), 0);
    });
    
    it('should do nothing if plan is already expired', async function(){
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:userBalance});
      await armor.increaseStake(armor.balanceManager, coverAmount.mul(10));
      await armor.increaseStake(armor.stakeManager, coverAmount.mul(10));
      await armor.setPrice(armor.stakeManager, price);
      await armor.setPrice(armor.balanceManager, price);
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
      const plan = await armor.planManager.getCurrentPlan(await user.getAddress());
      await increase(plan.end.add(1000).toNumber());
      await armor.balanceManager.keep();
    });
    
    it('should update expiretime when there is active plan', async function(){
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:userBalance});
      await armor.increaseStake(armor.balanceManager, coverAmount.mul(10));
      await armor.increaseStake(armor.stakeManager, coverAmount.mul(10));
      await armor.setPrice(armor.stakeManager, price);
      await armor.setPrice(armor.balanceManager, price);
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
    });

    it('should correctly remove latest totals if needed', async function(){
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:userBalance});
      await armor.increaseStake(armor.balanceManager, coverAmount.mul(10));
      await armor.increaseStake(armor.stakeManager, coverAmount.mul(10));
      await armor.setPrice(armor.stakeManager, price);
      await armor.setPrice(armor.balanceManager, price);
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
      const plan = await armor.planManager.getCurrentPlan(await user.getAddress());
      await increase(60*60*2);
      await armor.balanceManager.connect(user).withdraw(userBalance);
      let updated = await armor.planManager.totalUsedCover(armor.balanceManager.address);
      expect(updated.toString()).to.be.equal('0')
    });

  });

  describe('#planRedeemed()', function(){
    beforeEach(async function(){
      await armor.increaseStake(armor.balanceManager, coverAmount.mul(10));
      await armor.increaseStake(armor.stakeManager, coverAmount.mul(10));
      await armor.setPrice(armor.stakeManager, price);
      await armor.setPrice(armor.balanceManager, price);
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:userBalance});
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
    });
    it('should fail if msg.sender is not claimmanger', async function(){
      await expect(armor.planManager.connect(user).planRedeemed(await user.getAddress(), 0, armor.balanceManager.address)).to.be.revertedWith("only module CLAIM can call this function");
    });
    
    it('should fail if target plan is currently activated', async function(){
      //await expect(planManager.connect(claimManager).planRedeemed(await user.getAddress(), 0, balanceManager.address)).to.be.revertedWith("Cannot redeem active plan, update plan to redeem properly");
    });

    it('should change claim status to true', async function(){
      const plan = await armor.planManager.getCurrentPlan(await user.getAddress());
      await increase(plan.end.add(1000).toNumber());
      //await planManager.connect(claimManager).planRedeemed(await user.getAddress(), 0, balanceManager.address);
    });
  });

  describe('#getCurrentPlan()', function(){
    it('should return zeros when expired or empty', async function(){
      await armor.increaseStake(armor.balanceManager, coverAmount.mul(10));
      await armor.increaseStake(armor.stakeManager, coverAmount.mul(10));
      const empty = await armor.planManager.getCurrentPlan(await user.getAddress());
      expect(empty[0]).to.be.equal(0);
      expect(empty[1]).to.be.equal(0);
      //expect(empty[2]).to.be.equal(0);
      await armor.setPrice(armor.stakeManager, price);
      await armor.setPrice(armor.balanceManager, price);
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:userBalance});
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
      const plan = await armor.planManager.getCurrentPlan(await user.getAddress());
      await increase(plan.end.add(1000).toNumber());
      await mine();
      const expired = await armor.planManager.getCurrentPlan(await user.getAddress());
      expect(expired[0]).to.be.equal(0);
      expect(expired[1]).to.be.equal(0);
      //expect(expired[2]).to.be.equal(0);
    });
    it('should return appropriate values if active', async function(){
      await armor.increaseStake(armor.balanceManager, coverAmount.mul(10));
      await armor.increaseStake(armor.stakeManager, coverAmount.mul(10));
      await armor.setPrice(armor.stakeManager, price);
      await armor.setPrice(armor.balanceManager, price);
      await armor.balanceManager.deposit(await referrer.getAddress(), {value:userBalance});
      await armor.balanceManager.connect(user).deposit(await referrer.getAddress(), {value:userBalance});
      await armor.planManager.connect(user).updatePlan([armor.balanceManager.address], [coverAmount.mul(ETHER)]);
      const plan = await armor.planManager.getCurrentPlan(await user.getAddress());
      await increase(plan.end.add(1000).toNumber());
      await armor.planManager.getCurrentPlan(await user.getAddress());
    });
  });
});
