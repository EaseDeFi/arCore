import { balance, ether, expectRevert, send, expectEvent } from '@openzeppelin/test-helpers';
import {ethers} from 'hardhat';
import {expect} from 'chai';


describe('Address', function () {
  let recipient: any;
  let other: any;
  let signers: any;

  let AddressImpl : any;
  let EtherReceiver : any;
  let CallReceiverMock : any;
  beforeEach(async function () {
    signers = await ethers.getSigners();
    recipient = await signers[0].getAddress();
    other = await signers[1].getAddress();
    AddressImpl = await ethers.getContractFactory('AddressImpl');
    EtherReceiver = await ethers.getContractFactory('EtherReceiverMock');
    CallReceiverMock = await ethers.getContractFactory('CallReceiverMock');
    this.mock = await AddressImpl.deploy();
  });

  describe('isContract', function () {
    it('returns false for account address', async function () {
      expect(await this.mock.isContract(other)).to.equal(false);
    });

    it('returns true for contract address', async function () {
      const contract = await AddressImpl.deploy();
      expect(await this.mock.isContract(contract.address)).to.equal(true);
    });
  });

  describe('sendValue', function () {
    beforeEach(async function () {
    });

    context('when sender contract has no funds', function () {
      it('sends 0 wei', async function () {
        await this.mock.sendValue(other, 0);
      });

      it('reverts when sending non-zero amounts', async function () {
        await expect(this.mock.sendValue(other, 1)).to.be.revertedWith('Address: insufficient balance');
      });
    });

  });
});
