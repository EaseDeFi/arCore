import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants, utils } from "ethers";
import addresses from "../utils/addresses";
require("dotenv").config();

function stringToBytes32(str: string): string {
  return ethers.utils.formatBytes32String(str);
}

const getUpgradedProxy = async (
  owner: Signer,
  contractAddr: string,
  contractName: string
): Promise<Contract> => {
  const ProxyFactory = await ethers.getContractFactory(
    "OwnedUpgradeabilityProxy"
  );
  const toUpdate = await ProxyFactory.attach(contractAddr);
  const newContractFactory = await ethers.getContractFactory(contractName);
  const newContract = await newContractFactory.deploy();
  await toUpdate.connect(owner).upgradeTo(newContract.address);
  return newContractFactory.attach(contractAddr);
};

describe("RewardManagerV2 Mainnet Fork", function () {
  let rewardManagerV2: Contract;
  let rewardManager: Contract;
  let stakeManager: Contract;
  let planManager: Contract;
  let balanceManager: Contract;
  let master: Contract;

  let owner: Signer;
  let rewardCycle = BigNumber.from("8640"); // 1 day

  const forkNetworkWithBlock = async (blockNumber: number) => {
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMYAPI_KEY}`,
            blockNumber,
          },
        },
      ],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.armorMultiSig],
    });

    owner = await ethers.provider.getSigner(addresses.armorMultiSig);

    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    master = MasterFactory.attach(addresses.armorMaster);

    const RewardFactory = await ethers.getContractFactory("RewardManager");
    rewardManager = RewardFactory.attach(addresses.rewardManager);

    const RewardFactoryV2 = await ethers.getContractFactory("RewardManagerV2");

    rewardManagerV2 = await RewardFactoryV2.deploy();
    await rewardManagerV2
      .connect(owner)
      .initialize(master.address, rewardCycle);
    await master
      .connect(owner)
      .registerModule(stringToBytes32("REWARDV2"), rewardManagerV2.address);
  };

  describe("PlanManager", function () {
    beforeEach(async () => {
      await forkNetworkWithBlock(12945646);

      planManager = await getUpgradedProxy(
        owner,
        addresses.planManager,
        "PlanManager"
      );
    });

    it("should update alloc point when adjust total used cover", async function () {
      await planManager
        .connect(owner)
        .forceAdjustTotalUsedCover(addresses.protocols, ["100", "200"]);
      expect(await rewardManagerV2.totalAllocPoint()).to.equal("300");
      expect(
        (await rewardManagerV2.poolInfo(addresses.protocols[0])).allocPoint
      ).to.equal("100");
      expect(
        (await rewardManagerV2.poolInfo(addresses.protocols[1])).allocPoint
      ).to.equal("200");
    });
  });

  describe("StakeManager", function () {
    beforeEach(async () => {
      await forkNetworkWithBlock(12945646);
    });
    it("should deposit to rewardV2 when stakeNft", async function () {
      // Allow user
      const userAddress = "0x09fa38eba245bb68354b8950fa2fe71f02863393";
      const protocol = "0x0000000000000000000000000000000000000001";
      const coverPrice = "41194514158";
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [userAddress],
      });
      const user = await ethers.provider.getSigner(userAddress);

      stakeManager = await getUpgradedProxy(
        owner,
        addresses.stakeManager,
        "StakeManager"
      );
      await stakeManager.connect(user).stakeNft(5238);
      const userInfo = await rewardManagerV2.userInfo(protocol, userAddress);
      expect(userInfo.amount).to.equal(coverPrice);
    });

    it.skip("should withdraw from rewardV2 when withdrawNft", async function () {
      // Allow user
      const userAddress = "0x09fa38eba245bb68354b8950fa2fe71f02863393";
      const protocol = "0x0000000000000000000000000000000000000001";
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [userAddress],
      });
      const user = await ethers.provider.getSigner(userAddress);

      stakeManager = await getUpgradedProxy(
        owner,
        addresses.stakeManager,
        "StakeManager"
      );
      await stakeManager.connect(user).stakeNft(5238);
      expect(await stakeManager.coverMigrated(5238)).to.equal(true);
      await stakeManager.connect(user).withdrawNft(5238);
      const userInfo = await rewardManagerV2.userInfo(protocol, userAddress);
      expect(userInfo.amount).to.equal(0);
    });
  });

  describe("BalanceManager", function () {
    it("should notify v1 reward to RewardManagerV2", async function () {
      await forkNetworkWithBlock(13019974);
      balanceManager = await getUpgradedProxy(
        owner,
        addresses.balanceManager,
        "BalanceManager"
      );

      const pendingBalance = BigNumber.from("3191086092502782706");
      const currentBalance = BigNumber.from("56990099131813310240");
      expect(await balanceManager.balanceOf(addresses.rewardManager)).to.equal(
        pendingBalance
      );
      expect(await owner.provider.getBalance(addresses.rewardManager)).to.equal(
        currentBalance
      );
      await balanceManager.releaseFunds();
      expect(await owner.provider.getBalance(addresses.rewardManager)).to.equal(
        currentBalance
      );
      expect(await owner.provider.getBalance(rewardManagerV2.address)).to.equal(
        pendingBalance
      );
    });
  });
});
