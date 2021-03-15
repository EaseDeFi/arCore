import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase, mine } from "../utils";

const protocol = "0x11111254369792b2Ca5d084aB5eEA397cA8fa48B";
const ARMOR_MULTISIG = "0x1f28eD9D4792a567DaD779235c2b766Ab84D8E33";
const PLAN_MANAGER = "0x1337DEF1373bB63196F3D1443cE11D8d962543bB";
const CLAIM_MANAGER = "0x1337DEF1fdfDd82BA18083Fd0627d4ADb6CdC357";
const BALANCE_MANAGER = "0x1337DEF1c5EbBd9840E6B25C4438E829555395AA";
//for fork test
describe.only("ArmorClient", function(){
  let client : Contract;
  let planManager : Contract;
  let balanceManager : Contract;
  let claimManager : Contract;
  let user : Signer;
  let owner : Signer;
  beforeEach(async function(){
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ARMOR_MULTISIG]
    });
    owner = await ethers.provider.getSigner(ARMOR_MULTISIG);
    const PlanManagerFactory = await ethers.getContractFactory("PlanManager");
    const ClaimManagerFactory = await ethers.getContractFactory("ClaimManager");
    const BalanceManagerFactory = await ethers.getContractFactory("BalanceManager");
    const newBalanceManager = await BalanceManagerFactory.deploy();
    const newPlanManager = await PlanManagerFactory.deploy();
    const ProxyFactory = await ethers.getContractFactory("OwnedUpgradeabilityProxy");
    let toUpdate = await ProxyFactory.attach(PLAN_MANAGER);
    await toUpdate.connect(owner).upgradeTo(newPlanManager.address);
    toUpdate = await ProxyFactory.attach(BALANCE_MANAGER);
    await toUpdate.connect(owner).upgradeTo(newBalanceManager.address);
    planManager = await PlanManagerFactory.attach(PLAN_MANAGER);
    claimManager = await ClaimManagerFactory.attach(CLAIM_MANAGER);
    balanceManager = await BalanceManagerFactory.attach(BALANCE_MANAGER);

    const accounts = await ethers.getSigners();
    user = accounts[0];
    const ClientFactory = await ethers.getContractFactory("ArmorClientDemo");
    client = await ClientFactory.deploy();
    await client.setProtocol(protocol);
    await client.setFunds("1000000000000000000");
  });

  it('should be able to subscribe', async function(){
    await user.sendTransaction({to:client.address, value:BigNumber.from("100000000000000000000")});
    await client.updateArmorPlan();
    //sanity check for planmanager
    const plan = await planManager.getCurrentPlan(client.address);
    expect(plan.idx).to.equal(0);
    expect(plan.start).to.not.equal(0);
    expect(plan.end).to.not.equal(0);
    expect(plan.end.sub(plan.start)).to.equal(86400*30);
    const protocolDetail = await planManager.getProtocolPlan(client.address, plan.idx, protocol);
    expect(protocolDetail.amount).to.equal(BigNumber.from("1000000000000000000"));
  });

  it('should be able to claim when hacked', async function(){
    await user.sendTransaction({to:client.address, value:BigNumber.from("100000000000000000000")});
    await user.sendTransaction({to:claimManager.address, value:BigNumber.from("1000000000000000000000")});
    await client.updateArmorPlan();
    const now = await getTimestamp();
    await increase(1000000);
    await mine();
    console.log("CLIENT??");
    console.log(client.address);
    await claimManager.connect(owner).confirmHack(protocol, now.add(10));
    await client.endArmorPlan();
    await client.claimArmorPlan(now.add(10));
  });
});
