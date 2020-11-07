import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { time } from "@openzeppelin/test-helpers";
describe("ClaimManager", function () {
  let accounts: Signer[];
  let planManager: Contract;
  let claimManager: Contract;

  let arNFT: Contract;

  let user: Signer;
  let owner: Signer;
  beforeEach(async function () {
    const PlanFactory = await ethers.getContractFactory("PlanManagerMock");
    const ClaimFactory = await ethers.getContractFactory("ClaimManager");
    const arNFTFactory = await ethers.getContractFactory("arNFTMock");

    planManager = await PlanFactory.deploy();
    claimManager = await ClaimFactory.deploy();
    arNFT = await arNFTFactory.deploy();
    
    accounts = await ethers.getSigners(); 
    user = accounts[4];
    owner = accounts[0];
    await claimManager.initialize(planManager.address, arNFT.address);
  });
});
