import { network, ethers } from "hardhat";
import { providers, Contract, Signer, BigNumber, utils } from "ethers";
import { expect } from "chai";
import { increase, getTimestamp } from './utils';
const multisig_mainnet = "0x1f28ed9d4792a567dad779235c2b766ab84d8e33";
const controller_mainnet = "0x1337DEF159da6F97dB7c4D0E257dc689837b9E70";
const staker_mainnet = "0x1337DEF1B1Ae35314b40e5A4b70e216A499b0E37";
const borrower_mainnet = "0x1337DEF172152f2fF82d9545Fd6f79fE38dF15ce";
const token_mainnet = "0x1337def16f9b486faed0293eb623dc8395dfe46a";
let multisig : Signer;

let farmController : Contract;
let stakerFarm : Contract;
let borrowerFarm : Contract;
let token: Contract;

describe.only('fork', function(){
  beforeEach(async function(){
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [multisig_mainnet]
    });
    multisig = await ethers.provider.getSigner(multisig_mainnet);
    const proxy = await ethers.getContractAt("OwnedUpgradeabilityProxy", controller_mainnet);
    const NewTemplate = await ethers.getContractFactory("FarmController");
    const template  = await NewTemplate.deploy();
    await proxy.connect(multisig).upgradeTo(template.address);
    farmController = await ethers.getContractAt("FarmController", proxy.address);
    stakerFarm = await ethers.getContractAt("UtilizationFarm", staker_mainnet);
    borrowerFarm = await ethers.getContractAt("UtilizationFarm", borrower_mainnet);
    token = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", token_mainnet);
    await stakerFarm.connect(multisig).setRewardDistribution(proxy.address);
    await borrowerFarm.connect(multisig).setRewardDistribution(proxy.address);
  });

  it.only('changeProtocol - stakeManual', async function() {
    await farmController.connect(multisig).setRewards("10000", "100", "1");
    await token.connect(multisig).transfer(farmController.address, "10101");
    const beforeBalance = {
      staker: await token.balanceOf(staker_mainnet),
      borrower : await token.balanceOf(borrower_mainnet)
    }
    await farmController.flushRewards();
    const afterBalance = {
      staker: await token.balanceOf(staker_mainnet),
      borrower : await token.balanceOf(borrower_mainnet)
    }

    expect(afterBalance.staker).to.equal(beforeBalance.staker.add(100));
    expect(afterBalance.borrower).to.equal(beforeBalance.borrower.add(1));
  });
});
