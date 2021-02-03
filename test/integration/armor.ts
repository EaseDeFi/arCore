// got from nexusmutual/smart-contracts and changed to typescript
import { ethers } from "hardhat";
import { Contract, ContractFactory, Signer, BigNumber } from "ethers";
import { time } from "@openzeppelin/test-helpers";
import { NexusMutual } from './NexusMutual';

export class ArCore {
  constructor(deployer: Signer) {
    this.deployer = deployer;
  }

  async deploy(arNft: Contract, nexus: NexusMutual) {
  }

  async increaseStake(protocol: string, amount: number) {
  }

  async setPrice(protocol: string, price: number) {
  }
}
