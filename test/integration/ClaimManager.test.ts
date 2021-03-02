import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase, increaseTo } from "../utils";
import {ArmorCore} from "./ArmorCore";
function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}
describe("ClaimManager", function () {
  let accounts: Signer[];
  let token: Contract;
  let armor: ArmorCore;

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
    
    const TokenFactory = await ethers.getContractFactory("ArmorToken");
    token = await TokenFactory.deploy();

    armor = new ArmorCore(owner);
    await armor.deploy(token);
  });

  describe('#confirmHack()', function(){
    it('should fail if msg.sender is not owner',async function(){
      await expect(armor.claimManager.connect(user).confirmHack(armor.planManager.address, 100)).to.be.revertedWith('only owner can call this function');
    }); 
    it('should fail if _hackTime is future',async function(){
      const latest = await getTimestamp();
      await expect(
        armor.claimManager.connect(owner).confirmHack(armor.planManager.address,latest.add(1000).toString())
      ).to.be.revertedWith('Cannot confirm future');
    }); 
  });

  describe('#submitNft()', function(){
    let now;
    beforeEach(async function(){
      await armor.increaseStake(armor.arNft, BigNumber.from("100"));
      await increase(100);
      now = await getTimestamp();
      await armor.claimManager.connect(owner).confirmHack(armor.arNft.address, now.sub(1).toString());
    });

    it('should fail if hack is not confirmed yet', async function(){
      await expect(armor.claimManager.connect(owner).submitNft(1, now.sub(2).toString())).to.be.revertedWith("No hack with these parameters has been confirmed");
    });
    it('should success', async function(){
      await armor.claimManager.connect(owner).submitNft(1, now.sub(1).toString());
    });
  });
  describe('#redeemClaim()', function(){
    it('should be able to claim full coverage', async function(){

      const tenPow18 = BigNumber.from('1000000000000000000')

      // Setup
      const protocol = '0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8' // Random addr. from Etherscan
      await armor.stakeManager.connect(owner).allowProtocol(protocol, true);
      const price = BigNumber.from('100000000000000000000');
      const details = [BigNumber.from(100), BigNumber.from("1000000000000000000"), BigNumber.from(1000), BigNumber.from(10000000), BigNumber.from(1)];
      await armor.arNft.connect(user).buyCover(
        protocol,
        "0x45544800",
        details,
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await armor.arNft.connect(user).buyCover(
        protocol,
        "0x45544800",
        details,
        100,
        0,
        ethers.utils.randomBytes(32),
        ethers.utils.randomBytes(32)
      );
      await armor.arNft.connect(user).approve(armor.stakeManager.address, 1);
      await armor.stakeManager.connect(user).stakeNft(1);

      // Exploiter deposits 0.0001 ETH
      await armor.balanceManager.connect(user).deposit(await user.getAddress(), {value: BigNumber.from('10000000000000000000000')});

      await armor.claimManager.connect(owner).claim
      // This represents other users funds which are managed by the protocol
      // We directly deposit 10 ETH to make it easier for the demonstration
      await owner.sendTransaction({
        to: armor.claimManager.address,
        value: BigNumber.from('10000000000000000000')
      });

      // Exploiter buys cover for 1 WEI (0.000000000000000001 ETH)
      const COVER_AMOUNT = BigNumber.from('100000000000000000');
      await armor.planManager.connect(user).updatePlan([protocol], [COVER_AMOUNT]);

      // Confirm a hack on the protocol
      const plan = await armor.planManager.connect(user).getCurrentPlan(await user.getAddress());
      await increaseTo(plan.end.sub(BigNumber.from('100')).toNumber())
      const latest = await getTimestamp();
      await armor.claimManager.connect(owner).confirmHack(protocol,latest)

      // Exploiter claims his 1 WEI cover
      await increaseTo(plan.end.add(BigNumber.from('1')).toNumber())
      const beforeBalance = await user.getBalance();
      const tx = await armor.claimManager.connect(user).redeemClaim(protocol, latest, COVER_AMOUNT);

      const afterBalance = await user.getBalance()
      const diff = afterBalance.sub(beforeBalance);
      expect(afterBalance.sub(beforeBalance)).to.equal(COVER_AMOUNT.sub(tx.gasPrice.mul((await tx.wait()).gasUsed)));
    });
  });
});
