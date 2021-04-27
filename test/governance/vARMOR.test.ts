import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase, mine } from "../utils";

describe("vARMOR", function(){
  let armor: Contract;
  let varmor: Contract;
  let gov: Signer;
  let user: Signer;
  let delegator: Signer;
  let delegator2: Signer;
  let delegatee: Signer;
  let newDelegatee: Signer;

  const AMOUNT = BigNumber.from("1000000000000000000");
  beforeEach(async function(){
    const accounts = await ethers.getSigners();
    gov = accounts[0];
    user = accounts[1];
    delegator = accounts[2];
    delegator2 = accounts[3];
    delegatee = accounts[4];
    newDelegatee = accounts[5];
    const ArmorFactory = await ethers.getContractFactory("ERC20Mock");
    armor = await ArmorFactory.deploy();
    await armor.transfer(user.getAddress(), AMOUNT);
    const VArmorFactory = await ethers.getContractFactory("vARMOR");
    varmor = await VArmorFactory.deploy(armor.address, gov.getAddress());
  });

  describe("#deposit", function(){
    beforeEach(async function(){
      await armor.connect(user).approve(varmor.address, AMOUNT);
    });
    describe("when totalSupply == 0", function(){
      it("sanity check", async function(){
        expect(await varmor.totalSupply()).to.equal(0);
      });
      describe("effect", function(){
        beforeEach( async function(){
          await varmor.connect(user).deposit(AMOUNT);
        });

        it("totalSupply should increase", async function(){
          expect(await varmor.totalSupply()).to.equal(AMOUNT);
        });

        it("balanceOf should increase", async function(){
          expect(await varmor.balanceOf(user.getAddress())).to.equal(AMOUNT);
        });

        it("settled amount should increase", async function(){
          expect(await varmor.settledArmor()).to.equal(AMOUNT);
        });

        it("active armor should increase", async function(){
          expect(await varmor.activeArmor()).to.equal(AMOUNT);
        });
      });
    });
  });

  describe('ApplePieToken spec', function() {
    const totalAmount = BigNumber.from('10000');
    const voteAmount = BigNumber.from('10');
    beforeEach(async function(){
      await armor.approve(varmor.address, AMOUNT);
      await varmor.deposit(AMOUNT);
    });

    describe('#delegate()', function() {
      beforeEach(async function() {
        await varmor.transfer(delegator.getAddress(), voteAmount);
        await varmor.transfer(delegator2.getAddress(), voteAmount);
      });

      describe('Delegation: address(0) -> address(0)', async function() {
        beforeEach(async function() {
          await varmor.connect(delegator).delegate(constants.AddressZero);
        });

        it('Nothing happens', async function() {
          const numVotes = await varmor.getCurrentVotes(delegatee.getAddress());
          const currentDelegatee = await varmor.delegates(delegator.getAddress());
          expect(numVotes).to.equal(0);
          expect(currentDelegatee).to.equal(constants.AddressZero);
        });
      });


      describe('Delegation: address(0) -> delegatee', async function() {
        beforeEach(async function() {
          await varmor.connect(delegator).delegate(delegatee.getAddress());
        });

        it('delegatee Votes changes', async function() {
          const numVotes = await varmor.getCurrentVotes(delegatee.getAddress());
          const currentDelegatee = await varmor.delegates(delegator.getAddress());
          expect(numVotes).to.equal(voteAmount);
          expect(currentDelegatee).to.equal(await delegatee.getAddress());
        });
      });

      describe('Delegation: nonzero delegatee -> new nonzero delegatee', function() {
        beforeEach(async function() {
          await varmor.connect(delegator).delegate(delegatee.getAddress());
          await varmor.connect(delegator).delegate(newDelegatee.getAddress());
        });

        it('delegatee Votes change', async function() {
          const previousDelegateeNumVotes = await varmor.getCurrentVotes(delegatee.getAddress());
          const currentDelegateeNumVotes = await varmor.getCurrentVotes(newDelegatee.getAddress());
          const currentDelegatee = await varmor.delegates(delegator.getAddress());
          expect(previousDelegateeNumVotes).to.equal(0);
          expect(currentDelegateeNumVotes).to.equal(voteAmount);
          expect(currentDelegatee).to.equal(await newDelegatee.getAddress());
        });

      }); // End of 'Delegation: delegatee -> same delegatee'

      describe('Delegation: nonzero delegatee -> address(0)', function() {
        beforeEach(async function() {
          await varmor.connect(delegator).delegate(delegatee.getAddress());
          await varmor.connect(delegator).delegate(constants.AddressZero);
        });

        it('delegatee Votes change', async function() {
          const previousDelegateeNumVotes = await varmor.getCurrentVotes(delegatee.getAddress());
          const currentDelegatee = await varmor.delegates(delegator.getAddress());
          expect(previousDelegateeNumVotes).to.equal(0);
          expect(currentDelegatee).to.equal(constants.AddressZero);
        });
      }); // End of 'Delegation: nonzero delegatee -> address(0)'

      describe('Delegation: multiple delegator set same delegatee', function() {
        beforeEach(async function() {
          await varmor.connect(delegator).delegate(delegatee.getAddress());
          await varmor.connect(delegator2).delegate(delegatee.getAddress());
        });

        it('delegatee Votes change', async function() {
          const delegateeNumVotes = await varmor.getCurrentVotes(delegatee.getAddress());
          expect(delegateeNumVotes).to.equal(voteAmount.mul(2));
        });
      }); // End of 'Delegation: multiple delegator set same delegatee'
    }); // End of #delegate()

    describe('#getPriorVotes()', function() {
      const totalAmount = BigNumber.from('10000');
      const voteAmount = BigNumber.from('10');

      beforeEach(async function() {
        await varmor.transfer(delegator.getAddress(), voteAmount);
        await varmor.transfer(delegator2.getAddress(), voteAmount);
      });

      it('should fail if blockNumber is not finalized', async function() { 
        await expect(
          varmor.getPriorVotes(delegatee.getAddress(), BigNumber.from('10000'))).to.be.revertedWith(
          "vARMOR::getPriorVotes: not yet determined"
        );
      });

      it('should return 0 if account does not have any checkpoint', async function() {
        const numVotes = await varmor.getPriorVotes(delegatee.getAddress(), 0);
        expect(numVotes).to.equal(0);
      });
    });
  });
});
