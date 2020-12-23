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
  let claimManager: Contract;
  let stakeManager: Contract;

  let arNFT: Contract;

  let owner: Signer;
  let user: Signer;
  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[3];
    
    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    master = await MasterFactory.deploy();
    await master.connect(owner).initialize();

    const StakeFactory = await ethers.getContractFactory("StakeManager");
    stakeManager = await StakeFactory.deploy();
    await stakeManager.connect(owner).initialize(master.address);
    
    const PlanFactory = await ethers.getContractFactory("PlanManagerMock");
    planManager = await PlanFactory.deploy();
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
      await arNFT.connect(user).buyCover(
        arNFT.address,
        "0x45544800",
        [100, 10, 1000, 10000000, 1],
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).approve(stakeManager.address, 1);
    });
    it("should fail if nft is expired or 1 day before expiration", async function() {
      await increase(86400 * 100);
      await expect(stakeManager.connect(user).stakeNft(1)).to.be.revertedWith("NFT is expired or within 1 day of expiry.");
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
  });
});
