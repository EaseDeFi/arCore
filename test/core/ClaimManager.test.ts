import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase } from "../utils";
describe("ClaimManager", function () {
  let accounts: Signer[];
  let rewardManager: Contract;
  let planManager: Contract;
  let claimManager: Contract;
  let stakeManager: Contract;

  let arNFT: Contract;

  let user: Signer;
  let owner: Signer;
  beforeEach(async function () {
    const PlanFactory = await ethers.getContractFactory("PlanManagerMock");
    const RewardFactory = await ethers.getContractFactory("RewardManagerMock");
    const arNFTFactory = await ethers.getContractFactory("arNFTMock");
    const StakeFactory = await ethers.getContractFactory("StakeManager");
    const ClaimFactory = await ethers.getContractFactory("ClaimManager");

    stakeManager = await StakeFactory.deploy();

    rewardManager = await RewardFactory.deploy();
    planManager = await PlanFactory.deploy();
    claimManager = await ClaimFactory.deploy();
    arNFT = await arNFTFactory.deploy();
    
    accounts = await ethers.getSigners(); 
    user = accounts[4];
    owner = accounts[0];
    await claimManager.initialize(planManager.address, stakeManager.address, arNFT.address);
    await stakeManager.initialize(arNFT.address, rewardManager.address, planManager.address, claimManager.address);
  });

  describe('#confirmHack()', function(){
    it('should fail if msg.sender is not owner',async function(){
      await expect(claimManager.connect(user).confirmHack(planManager.address, 100)).to.be.revertedWith('msg.sender is not owner');
    }); 
    it('should fail if _hackTime is future',async function(){
      const latest = await getTimestamp();
      await expect(
        claimManager.connect(owner).confirmHack(planManager.address,latest.add(1000).toString())// latest.addn(10000))
      ).to.be.revertedWith('Cannot confirm future');
    }); 
  });

  describe('#submitNft()', function(){
    let now;
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
      await increase(100);
      now = await getTimestamp();
      await claimManager.connect(owner).confirmHack(arNFT.address, now.sub(1).toString());
    });

    it('should fail if hack is not confirmed yet', async function(){
      await expect(claimManager.connect(user).submitNft(0, now.sub(2).toString())).to.be.revertedWith("No hack with these parameters has been confirmed");
    });
    it('should success', async function(){
      await claimManager.connect(user).submitNft(0, now.sub(1).toString());
    });
  });

  describe('#redeemNft()', function(){});

  describe('#redeemClaim()', function(){});
});
