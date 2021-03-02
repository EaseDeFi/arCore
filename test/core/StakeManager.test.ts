import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { time } from "@openzeppelin/test-helpers";
import { increase } from "../utils";

function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}
describe("StakeManager", function () {
  let accounts: Signer[];
  let master: Contract;
  let rewardManager: Contract;
  let planManager: Contract;
  let balanceManager: Contract;
  let claimManager: Contract;
  let stakeManager: Contract;
  let utilizationFarm: Contract;
  let arNFT: Contract;
  let token: Contract;

  let owner: Signer;
  let user: Signer;
  let dev: Signer;
  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[3];
    dev = accounts[4];
    
    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    master = await MasterFactory.deploy();
    await master.connect(owner).initialize();

    const StakeFactory = await ethers.getContractFactory("StakeManager");
    stakeManager = await StakeFactory.deploy();
    await stakeManager.connect(owner).initialize(master.address);
    await master.connect(owner).registerModule(stringToBytes32("STAKE"), stakeManager.address);
    
    const BalanceFactory = await ethers.getContractFactory("BalanceManagerMock");
    balanceManager = await BalanceFactory.deploy();
    //await balanceManager.connect(owner).initialize(master.address, dev.getAddress());
    await master.connect(owner).registerModule(stringToBytes32("BALANCE"), balanceManager.address);
    //await balanceManager.toggleUF();
    
    const PlanFactory = await ethers.getContractFactory("PlanManager");
    planManager = await PlanFactory.deploy();
    await planManager.initialize(master.address);
    await master.connect(owner).registerModule(stringToBytes32("PLAN"), planManager.address);

    const RewardFactory = await ethers.getContractFactory("RewardManagerMock");
    rewardManager = await RewardFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("REWARD"), rewardManager.address);
    
    const ClaimFactory = await ethers.getContractFactory("ClaimManagerMock");
    claimManager = await ClaimFactory.deploy();
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
  });

  describe("#stakeNft()", function(){
    beforeEach(async function(){
      const details = [BigNumber.from(100), BigNumber.from("1000000000000000000"), BigNumber.from(1000), BigNumber.from(10000000), BigNumber.from(1)];
      await stakeManager.connect(owner).allowProtocol(arNFT.address, true);
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        details,
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        details,
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).approve(stakeManager.address, 1);
    });
    it("should fail if nft is expired or 1 day before expiration", async function() {
      await increase(86400 * 100);
      await expect(stakeManager.connect(user).stakeNft(1)).to.be.revertedWith("NFT is expired or within 20 days of expiry.");
    });
    it("should fail if nft submitted to claim", async function() {
      await arNFT.connect(user).submitClaim(1);
      await arNFT.connect(user).mockSetCoverStatus(1, 1);
      await expect(stakeManager.connect(user).stakeNft(1)).to.be.revertedWith("arNFT claim is already in progress.");
    });
    it("should fail if scAddress is not approved", async function() {
      await stakeManager.connect(owner).allowProtocol(arNFT.address, false);
      await expect(stakeManager.connect(user).stakeNft(1)).to.be.revertedWith("Protocol is not allowed to be staked.");
    });
    it("should fail if currency is not ETH is not approved", async function() {
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544801",
        [100, 10, 1000, 10000000, 1],
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await expect(stakeManager.connect(user).stakeNft(2)).to.be.revertedWith("Only Ether arNFTs may be staked.");
    });
    it("should be able to stake valid nft", async function(){
      await expect(stakeManager.connect(user).stakeNft(1)).to.emit(stakeManager, 'StakedNFT');
    });
    it("should set valid nftCoverPrice", async function(){
      await expect(stakeManager.connect(user).stakeNft(1)).to.emit(stakeManager, 'StakedNFT');
      expect(await planManager.nftCoverPrice(arNFT.address)).to.equal(BigNumber.from("1000000000000000000").div(100 * 86400 * 100));
      // should be 1e18 / (100 * 86400 * 100) 
    });
    it("should be able to stake when uf is off", async function(){
      await stakeManager.toggleUF();
      await expect(stakeManager.connect(user).stakeNft(1)).to.emit(stakeManager, 'StakedNFT');
    });
  });

  describe("#withdrawNft()", function(){
    beforeEach(async function(){
      await stakeManager.connect(owner).allowProtocol(arNFT.address, true);
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        [100, 10000000000000, 1000, 10000000, 1],
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        [100, 10000000000000, 1000, 10000000, 1],
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).approve(stakeManager.address, 1);
    });
    it('should be able to call withdrawNft even uf is off', async function(){
      await stakeManager.connect(user).stakeNft(1);
      await stakeManager.connect(user).withdrawNft(1);

      await stakeManager.toggleUF();
      let stake = await utilizationFarm.balanceOf(user.getAddress());
      await increase(7 * 86400);
      await stakeManager.connect(user).withdrawNft(1);
    });
    it('do nothing if withdrawal is already queued and had not met withdrawal time', async function(){
      await stakeManager.connect(user).stakeNft(1);
      await stakeManager.changeWithdrawalDelay(100);
      await stakeManager.connect(user).withdrawNft(1);

      let stake = await utilizationFarm.balanceOf(user.getAddress());
      await stakeManager.connect(user).withdrawNft(1);
    });
    it('should be able to withdraw if withdrawal time has met', async function(){
      await stakeManager.connect(user).stakeNft(1);
      await stakeManager.connect(user).withdrawNft(1);

      let stake = await utilizationFarm.balanceOf(user.getAddress());
      await stakeManager.connect(user).withdrawNft(1);
    });

    it('should not be able to withdraw if cover is being borrowed', async function(){
      let userBalance = BigNumber.from("100000000000000000000");
      await stakeManager.connect(user).stakeNft(1);
      await balanceManager.setBalance(await user.getAddress(), userBalance);
      await planManager.connect(user).updatePlan([arNFT.address], [1]);
      await expect(stakeManager.connect(user).withdrawNft(1)).to.be.revertedWith("May not withdraw NFT if it will bring staked amount below borrowed amount.");
    });
  });
});
