import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase, increaseTo, mine } from "../utils";

describe("Vesting", function(){
  let vesting: Contract;
  let token: Contract;
  let now: BigNumber;
  const totalAmount = BigNumber.from("100000000000000000000");
  const period = BigNumber.from("10000");

  let recipients: Signer[];
  let weights: number[];
  beforeEach(async function(){
    const accounts = await ethers.getSigners();
    recipients = accounts.slice(1, 11 + 1);
    weights = [1000,2000,3000,4000,5000,6000,7000,8000,9000,10000,0];
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
      expect(await vesting.totalWeight()).to.equal(55000);
      expect(await vesting.token()).to.equal(token.address);
      expect(await vesting.totalTokens()).to.equal(totalAmount);
    });
  });

  describe("#claimableAmount()", function(){
    it("should return 0 if release has not started", async function(){
      for(let i = 0; i<recipients.length - 1 ; i++){
        const amount = await vesting.claimableAmount(recipients[i].getAddress());
        expect(amount).to.equal(BigNumber.from(0));
      }
    });

    it("should return appropriate amount if user has never released any token", async function(){
      await increaseTo(now.add(100).toNumber());
      await increase(100);
      await mine();
      for(let i = 0; i<recipients.length - 1; i++){
        const expectedAmount = totalAmount.mul(i+1).div(55).div(100);
        const amount = await vesting.claimableAmount(recipients[i].getAddress());
        expect(amount).to.equal(expectedAmount);
      }
    });
    
    it("should return appropriate amount if user has released token", async function(){
      await increaseTo(now.add(100).toNumber());
      await increase(100);
      await mine();
      for(let i = 0; i<recipients.length - 1; i++){
        await vesting.connect(recipients[i]).claim();
      }
      await increaseTo(now.add(300).toNumber());
      await mine();
      for(let i = 0; i<recipients.length - 1; i++){
        const expectedAmount = totalAmount.mul(i+1).div(55).div(50);
        const amount = await vesting.claimableAmount(recipients[i].getAddress());
        expect((await token.balanceOf(recipients[i].getAddress())).add(amount)).to.equal(expectedAmount);
      }
    });
  });

  describe("#claim()", async function(){
    it("should fail if release is not started yet", async function(){
      await expect(vesting.connect(recipients[0]).claim()).to.be.reverted;
    });

    it("should release the appropriate values", async function(){
      await increaseTo(now.add(100).toNumber());
      await increase(300);
      await vesting.connect(recipients[0]).claim();
      const expectedAmount = totalAmount.mul(3).div(55).div(100);
      expect(await token.balanceOf(recipients[0].getAddress())).to.equal(expectedAmount);
    });

    it("should release appropriate values even if there was a claim", async function(){
      await increaseTo(now.add(100).toNumber());
      await increase(100);
      await vesting.connect(recipients[0]).claim();
      expect(await vesting.released(recipients[0].getAddress())).to.equal(totalAmount.mul(1).div(55).div(100));
      await increaseTo(now.add(400).toNumber());
      await vesting.connect(recipients[0]).claim();
      const expectedAmount = totalAmount.mul(3).div(55).div(100);
      expect(await token.balanceOf(recipients[0].getAddress())).to.equal(expectedAmount);
    });
  });

  describe("#transfer()", async function(){
    it("should fail if release is not started yet", async function(){
      await expect(vesting.connect(recipients[0]).transfer(recipients[1],1000)).to.be.reverted;
    });

    it("should transfer the appropriate values", async function(){
      await increaseTo(now.add(100).toNumber());
      await increase(300);
      await vesting.connect(recipients[0]).transfer(recipients[10].getAddress(),1000);
      const expectedAmount = totalAmount.mul(3).div(55).div(100);
      expect(await vesting.releasable(recipients[0].getAddress())).to.equal(expectedAmount);
      expect(await vesting.weights(recipients[10].getAddress())).to.equal(100);
      expect(await vesting.weights(recipients[0].getAddress())).to.equal(900);
    });

    it("should release appropriate values after a transfer", async function(){
      await increaseTo(now.add(100).toNumber());
      await increase(100);
      await vesting.connect(recipients[0]).transfer(recipients[10].getAddress(),1000);

      await increaseTo(now.add(100).toNumber());
      await increase(100);

      await vesting.connect(recipients[0]).claim();
      await vesting.connect(recipients[10]).claim();

      expect(await vesting.released(recipients[0].getAddress())).to.equal(totalAmount.mul(1).div(55).div(100));
      await vesting.connect(recipients[0]).claim();
      await vesting.connect(recipients[10]).claim();
      const expectedAmount = totalAmount.mul(9).div(550).div(1000);
      const expectedAmount2 = totalAmount.mul(1).div(550).div(1000);

      expect(await token.balanceOf(recipients[0].getAddress())).to.equal(expectedAmount);
      expect(await token.balanceOf(recipients[10].getAddress())).to.equal(expectedAmount2);
    });
  });

});
