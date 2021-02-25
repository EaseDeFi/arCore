import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { time } from "@openzeppelin/test-helpers";
import { increase } from "../utils";

function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}
describe("UtilizationFarm", function () {
  let accounts: Signer[];
  let master: Contract;
  let rewardManager: Contract;
  let planManager: Contract;
  let claimManager: Contract;
  let stakeManager: Contract;
  let utilizationFarm: Contract;
  let arNFT: Contract;
  let token: Contract;
  let balanceManager: Contract;

  let owner: Signer;
  let user: Signer;
  let dev: Signer;
  let referrer: Signer;

  const RewardAmount = BigNumber.from("100000000000");
  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[3];
    dev = accounts[2];
    referrer = accounts[1];

    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    master = await MasterFactory.deploy();
    await master.connect(owner).initialize();

    const StakeFactory = await ethers.getContractFactory("StakeManager");
    stakeManager = await StakeFactory.deploy();
    await stakeManager.connect(owner).initialize(master.address);
    await master.connect(owner).registerModule(stringToBytes32("STAKE"), stakeManager.address);
    
    const PlanFactory = await ethers.getContractFactory("PlanManagerMock");
    planManager = await PlanFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("PLAN"), planManager.address);

    const RewardFactory = await ethers.getContractFactory("RewardManagerMock");
    rewardManager = await RewardFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("REWARD"), rewardManager.address);
    
    const ClaimFactory = await ethers.getContractFactory("ClaimManager");
    claimManager = await ClaimFactory.deploy();
    await claimManager.connect(owner).initialize(master.address);
    await master.connect(owner).registerModule(stringToBytes32("CLAIM"), claimManager.address);
    
    const arNFTFactory = await ethers.getContractFactory("arNFTMock");
    arNFT = await arNFTFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("ARNFT"), arNFT.address);

    // job
    await master.connect(owner).addJob(stringToBytes32("STAKE"));

    const TokenFactory = await ethers.getContractFactory("ArmorToken");
    token = await TokenFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("ARMOR"), token.address);

    const UtilizationFarm = await ethers.getContractFactory("UtilizationFarm");
    utilizationFarm = await UtilizationFarm.deploy();
    await utilizationFarm.initialize(token.address, master.address);
    await master.connect(owner).registerModule(stringToBytes32("UFS"), utilizationFarm.address);
    // TODO this is not good
    await master.connect(owner).registerModule(stringToBytes32("UFB"), utilizationFarm.address);

    const BalanceFactory = await ethers.getContractFactory("BalanceManager");
    balanceManager = await BalanceFactory.deploy();
    await balanceManager.initialize(master.address, await dev.getAddress());
    await master.connect(owner).registerModule(stringToBytes32("BALANCE"), balanceManager.address);
    await master.connect(owner).addJob(stringToBytes32("BALANCE"));
    await utilizationFarm.setRewardDistribution(owner.getAddress());
    await token.approve(utilizationFarm.address, RewardAmount);
    await utilizationFarm.notifyRewardAmount(RewardAmount);
    await token.approve(utilizationFarm.address, RewardAmount);
    await utilizationFarm.notifyRewardAmount(RewardAmount);
  });

  describe("#staking", function(){
    beforeEach(async function(){
      await stakeManager.connect(owner).allowProtocol(arNFT.address, true);
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        [100, 10000000000000, 1000, 10000000, 1],
        10,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        [100, 10000000000000, 1000, 10000000, 1],
        10,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).approve(stakeManager.address, 1);
      await arNFT.connect(user).approve(stakeManager.address, 1);
    });

    it("should add correctly on stake", async function() {
      await stakeManager.connect(user).stakeNft(1);
      let stake = await utilizationFarm.balanceOf(user.getAddress());
      expect(stake.toString()).to.equal("11574074");
    });
    
    it("should remove correctly on stake expiry", async function() {
      await stakeManager.connect(user).stakeNft(1);
      await increase(10 * 86400)

      await stakeManager.connect(user).keep();

      let stake = await utilizationFarm.balanceOf(user.getAddress());
      expect(stake.toString()).to.equal("0");
    });

    it("should remove correctly on stake withdrawal", async function() {
      await stakeManager.connect(user).stakeNft(1);
      await stakeManager.connect(user).withdrawNft(1);

      let stake = await utilizationFarm.balanceOf(user.getAddress());
      expect(stake.toString()).to.equal("0");

      await increase(7 * 86400);
      await stakeManager.connect(user).withdrawNft(1);

      stake = await utilizationFarm.balanceOf(user.getAddress());
      expect(stake.toString()).to.equal("0");
    });

  });

  describe("#borrowing", function () {
    const amount = ethers.BigNumber.from("1000000000000000000");
    
    beforeEach(async function() {
      await balanceManager.connect(user).deposit(referrer.getAddress(), {value:amount});
      await planManager.mockChangePrice(balanceManager.address, user.getAddress(),amount.div(1000000));
    });

    it('should add correctly on deposit', async function() {
      let stake = await utilizationFarm.balanceOf(user.getAddress());
      expect(stake.toString()).to.equal("1000000000000")
    });

    it.only("should remove correctly on withdrawal/expiry", async function (){
      await increase(10000);
      await balanceManager.connect(user).withdraw(amount);

      // Keeper
      await balanceManager.connect(dev).deposit(referrer.getAddress(), {value:amount});

      let stake = await utilizationFarm.balanceOf(user.getAddress());
      expect(stake.toString()).to.equal("0");
    });

    it("should alter correctly on pricePerSecond rising", async function (){
        await planManager.mockChangePrice(balanceManager.address, await user.getAddress(),amount.div(10000));
        let stake = await utilizationFarm.balanceOf(user.getAddress());
        expect(stake.toString()).to.equal("100000000000000");
    });

    it("should alter correctly on pricePerSecond lowering", async function (){
      await planManager.mockChangePrice(balanceManager.address, await user.getAddress(),amount.div(10000000000));
      let stake = await utilizationFarm.balanceOf(user.getAddress());
      expect(stake.toString()).to.equal("100000000");    
    });
  });

  describe("#getReward()", function(){
    beforeEach(async function(){
      await stakeManager.connect(owner).allowProtocol(arNFT.address, true);
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        [100, 10000000000000, 1000, 10000000, 1],
        10,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        [100, 10000000000000, 1000, 10000000, 1],
        10,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).approve(stakeManager.address, 1);
      await stakeManager.connect(user).stakeNft(1);
      await token.approve(utilizationFarm.address, RewardAmount);
      await utilizationFarm.notifyRewardAmount(RewardAmount);
    });

    it("should be able to get reward", async function(){
      await increase(86400);
      await utilizationFarm.connect(user).getReward(user.getAddress());
      await utilizationFarm.connect(dev).getReward(dev.getAddress());
    });
  });
});
