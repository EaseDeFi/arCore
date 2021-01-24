import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase, increaseTo, mine } from "../utils";

describe.only("Vesting", function(){
  let vesting: Contract;
  let token: Contract;
  let now: BigNumber;
  const totalAmount = BigNumber.from("100000000000000000000");
  const period = BigNumber.from("10000");

  let recipients: Signer[];
  let weights: number[];
  beforeEach(async function(){
    const accounts = await ethers.getSigners();
    recipients = accounts.slice(1, 10 + 1);
    weights = [1,2,3,4,5,6,7,8,9,10];
    const Vesting = await ethers.getContractFactory("Vesting");
    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    token = await ERC20.deploy();
    vesting = await Vesting.deploy();
    now = await getTimestamp();
    await token.approve(vesting.address, totalAmount);
    await vesting.initialize(token.address, totalAmount, now.add(100), period, recipients.map(async x => await x.getAddress()), weights);
  });
  describe("#initialize()", function(){
    it("should fail if already initialize",async function() {
      await expect(vesting.initialize(token.address, totalAmount, now.add(100), period,recipients, weights)).to.be.reverted;
    });
    it("should set appropriate values", async function(){
      expect(await vesting.totalWeight()).to.equal(55);
      expect(await vesting.token()).to.equal(token.address);
      expect(await vesting.totalTokens()).to.equal(totalAmount);
    });
  });

  describe("#claimableAmount()", function(){
    it("should return 0 if release has not started", async function(){
      for(let i = 0; i<recipients.length; i++){
        const amount = await vesting.claimableAmount(recipients[i].getAddress());
        expect(amount).to.equal(BigNumber.from(0));
      }
    });

    it("should return appropriate amount if user has never released any token", async function(){
      await increaseTo(now.add(100).toNumber());
      await increase(100);
      await mine();
      for(let i = 0; i<recipients.length; i++){
        const expectedAmount = totalAmount.mul(i+1).div(55).div(100);
        const amount = await vesting.claimableAmount(recipients[i].getAddress());
        expect(amount).to.equal(expectedAmount);
      }
    });
    
    it("should return appropriate amount if user has released token", async function(){
      await increaseTo(now.add(100).toNumber());
      await increase(100);
      await mine();
      for(let i = 0; i<recipients.length; i++){
        await vesting.connect(recipients[i]).claim();
      }
      await increaseTo(now.add(300).toNumber());
      await mine();
      for(let i = 0; i<recipients.length; i++){
        const expectedAmount = totalAmount.mul(i+1).div(55).div(50);
        const amount = await vesting.claimableAmount(recipients[i].getAddress());
        expect((await token.balanceOf(recipients[i].getAddress())).add(amount)).to.equal(expectedAmount);
      }
    });
  });
});
