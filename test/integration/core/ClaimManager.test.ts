import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase, increaseTo } from "../utils";

function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}
describe("ClaimManager", function () {
  let accounts: Signer[];
  let rewardManager: Contract;
  let balanceManager: Contract;
  let token: Contract;
  let planManager: Contract;
  let claimManager: Contract;
  let stakeManager: Contract;
  let master: Contract;
  let ufs: Contract;
  let ufb: Contract;

  let arNFT: Contract;

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

    const PlanFactory = await ethers.getContractFactory("PlanManager");
    planManager = await PlanFactory.deploy();
    await planManager.initialize(master.address);
    await master.connect(owner).registerModule(stringToBytes32("PLAN"), planManager.address);
    
    const TokenFactory = await ethers.getContractFactory("ArmorToken");
    token = await TokenFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("ARMOR"), token.address);
    
    const RewardFactory = await ethers.getContractFactory("RewardManagerMock");
    rewardManager = await RewardFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("REWARD"), rewardManager.address);

    const StakeFactory = await ethers.getContractFactory("StakeManager");
    stakeManager = await StakeFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("STAKE"), stakeManager.address);
    await stakeManager.initialize(master.address);
    
    const arNFTFactory = await ethers.getContractFactory("arNFTMock");
    arNFT = await arNFTFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("ARNFT"), arNFT.address);

    const ClaimFactory = await ethers.getContractFactory("ClaimManager");
    claimManager = await ClaimFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("CLAIM"), claimManager.address);
    await claimManager.initialize(master.address);

    const UtilizationFarm = await ethers.getContractFactory("UtilizationFarm");
    ufs = await UtilizationFarm.deploy();
    await ufs.initialize(token.address, master.address);
    await master.connect(owner).registerModule(stringToBytes32("UFS"), ufs.address);
    ufb = await UtilizationFarm.deploy();
    await ufb.initialize(token.address, master.address);
    await master.connect(owner).registerModule(stringToBytes32("UFB"), ufb.address);
  });

  describe('#confirmHack()', function(){
    it('should fail if msg.sender is not owner',async function(){
      await expect(claimManager.connect(user).confirmHack(planManager.address, 100)).to.be.revertedWith('only owner can call this function');
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
      await stakeManager.connect(user).stakeNft(1);
      await increase(100);
      now = await getTimestamp();
      await claimManager.connect(owner).confirmHack(arNFT.address, now.sub(1).toString());
    });

    it('should fail if hack is not confirmed yet', async function(){
      await expect(claimManager.connect(user).submitNft(1, now.sub(2).toString())).to.be.revertedWith("No hack with these parameters has been confirmed");
    });
    it('should success', async function(){
      await claimManager.connect(user).submitNft(1, now.sub(1).toString());
    });
  });

  describe('#redeemNft()', function(){});

  describe('#redeemClaim()', function(){
    it('should be able to claim full coverage', async function(){

      const tenPow18 = BigNumber.from('1000000000000000000')

      // Setup
      const protocol = '0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8' // Random addr. from Etherscan
      await stakeManager.connect(owner).allowProtocol(protocol, true);
      const price = BigNumber.from('100000000000000000000');
      const details = [BigNumber.from(100), BigNumber.from("1000000000000000000"), BigNumber.from(1000), BigNumber.from(10000000), BigNumber.from(1)];
      await arNFT.connect(user).buyCover(
        protocol,
        "0x45544800",
        details,
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).buyCover(
        protocol,
        "0x45544800",
        details,
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await arNFT.connect(user).approve(stakeManager.address, 1);
      await stakeManager.connect(user).stakeNft(1);

      // Exploiter deposits 0.0001 ETH
      await balanceManager.connect(user).deposit(await user.getAddress(), {value: BigNumber.from('10000000000000000000000')});

      await claimManager.connect(owner).claim
      // This represents other users funds which are managed by the protocol
      // We directly deposit 10 ETH to make it easier for the demonstration
      await owner.sendTransaction({
        to: claimManager.address,
        value: BigNumber.from('10000000000000000000')
      });

      // Exploiter buys cover for 1 WEI (0.000000000000000001 ETH)
      const COVER_AMOUNT = BigNumber.from('100000000000000000');
      await planManager.connect(user).updatePlan([protocol], [COVER_AMOUNT]);

      // Confirm a hack on the protocol
      const plan = await planManager.connect(user).getCurrentPlan(await user.getAddress());
      await increaseTo(plan.end.sub(BigNumber.from('100')).toNumber())
      const latest = await getTimestamp();
      await claimManager.connect(owner).confirmHack(protocol,latest)

      // Exploiter claims his 1 WEI cover
      await increaseTo(plan.end.add(BigNumber.from('1')).toNumber())
      const beforeBalance = await user.getBalance();
      const tx = await claimManager.connect(user).redeemClaim(protocol, latest, COVER_AMOUNT);

      const afterBalance = await user.getBalance()
      const diff = afterBalance.sub(beforeBalance);
      expect(afterBalance.sub(beforeBalance)).to.equal(COVER_AMOUNT.sub(tx.gasPrice.mul((await tx.wait()).gasUsed)));
    });
  });
});
