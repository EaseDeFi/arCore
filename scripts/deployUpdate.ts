import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { toChecksumAddress } from "ethereumjs-util";
function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}
function ether(amount: string) : BigNumber {
    return ethers.utils.parseEther(amount);
}
async function main() {
    let accounts: Signer[];
    let master: Contract;
    let claimManager: Contract;
    let exchangeManager: Contract;
    let token: Contract;
    let owner: Signer;
    let user: Signer;
    let dev: Signer;
    let referrer: Signer;

    master = await ethers.getContractAt("ArmorMaster", toChecksumAddress("0x1337def1900ceaabf5361c3df6af653d814c6348"));


    // Deploy proxy
    // Deploy ExchangeManager
    // Initialize with master and my own address
    // Deploy ClaimManager
    // Change proxy to point to new master
    // Add ExchangeManager proxy as EXCHANGE module

    const ExchangeFactory = await ethers.getContractFactory("ExchangeManager");
    exchangeManager = await ExchangeFactory.deploy();
    
    // deploy proxy

    // initialize proxy //await exchangeManager.initialize(master.address,toChecksumAddress("0x531ed64E65B1D2f569fEaBbAd73beF04ac249378"));

    const ClaimFactory = await ethers.getContractFactory("ClaimManager");
    claimManager = await ClaimFactory.deploy();
    
    // Switch ClaimManager proxy to this implementation

    // Add ExchangeManager proxy as EXCHANGE module

}

main()