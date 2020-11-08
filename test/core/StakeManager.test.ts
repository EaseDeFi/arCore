import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { time } from "@openzeppelin/test-helpers";
describe("StakeManager", function () {
  let accounts: Signer[];
  let rewardManager: Contract;
  let planManager: Contract;
  let claimManager: Contract;
  let stakeManager: Contract;

  let arNFT: Contract;

  let user: Signer;
  let owner: Signer;
  beforeEach(async function () {
    const StakeFactory = await ethers.getContractFactory("StakeManager");
    stakeManager = await StakeFactory.deploy();
    const PlanFactory = await ethers.getContractFactory("PlanManagerMock");
    const RewardFactory = await ethers.getContractFactory("RewardManagerMock");
    const ClaimFactory = await ethers.getContractFactory("ClaimManagerMock");
    const arNFTFactory = await ethers.getContractFactory("arNFTMock");

    rewardManager = await RewardFactory.deploy();
    planManager = await PlanFactory.deploy();
    claimManager = await ClaimFactory.deploy();
    arNFT = await arNFTFactory.deploy();
    
    accounts = await ethers.getSigners(); 
    user = accounts[4];
    owner = accounts[0];
    await stakeManager.connect(owner).initialize(arNFT.address, rewardManager.address, planManager.address, claimManager.address);

  });

  describe("#stakeNft()", function(){
    beforeEach(async function(){
      await stakeManager.connect(owner).allowProtocol(arNFT.address, true);
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        [100, 10, 1000, 10000000, 1],
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).approve(stakeManager.address, 0);
    });
    it("should fail if nft is expired or 1 day before expiration", async function() {
      await time.increase(time.duration.days(100));
      await expect(stakeManager.connect(user).stakeNft(0)).to.be.revertedWith("NFT is expired or within 1 day of expiry.");
    });
    it("should fail if nft submitted to claim", async function() {
      await arNFT.connect(user).submitClaim(0);
      await arNFT.connect(user).mockSetCoverStatus(0, 1);
      await expect(stakeManager.connect(user).stakeNft(0)).to.be.revertedWith("arNFT claim is already in progress.");
    });
    it("should fail if scAddress is not approved", async function() {
      await stakeManager.connect(owner).allowProtocol(arNFT.address, false);
      await expect(stakeManager.connect(user).stakeNft(0)).to.be.revertedWith("Protocol is not allowed to be staked.");
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
      await expect(stakeManager.connect(user).stakeNft(1)).to.be.revertedWith("Only Ether arNFTs may be staked.");
    });
    it("should be able to stake valid nft", async function(){
      await expect(stakeManager.connect(user).stakeNft(0)).to.emit(stakeManager, 'StakedNFT');
    });
  });

  describe("#removeExpiredNft()", async function(){
    beforeEach(async function(){
      await stakeManager.connect(owner).allowProtocol(arNFT.address, true);
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        [100, 10, 1000, 10000000, 1],
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).approve(stakeManager.address, 0);
      await stakeManager.connect(user).stakeNft(0);
    });

    it("should fail if nft is not expired", async function(){
      await arNFT.mockSetCoverStatus(0, 1);
      await expect(stakeManager.connect(user).removeExpiredNft(0)).to.be.reverted;
    });
    
    it("should success if nft is expired", async function(){
      await arNFT.mockSetCoverStatus(0, 3);
      await stakeManager.connect(user).removeExpiredNft(0);
    });
  });
});
