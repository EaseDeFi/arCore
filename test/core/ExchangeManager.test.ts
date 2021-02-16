import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { increase } from "../utils";
function stringToBytes32(str: string) : string {
  return ethers.utils.formatBytes32String(str);
}
describe.only("ExchangeManager", function () {
  let accounts: Signer[];
  let master: Contract;
  let claimManager: Contract;
  let exchangeManager: Contract;
  let token: Contract;
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
    
    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    master = await MasterFactory.deploy();
    await master.connect(owner).initialize();
    const ClaimFactory = await ethers.getContractFactory("ClaimManagerMock");
    claimManager = await ClaimFactory.deploy();
    await master.connect(owner).registerModule(stringToBytes32("CLAIM"), claimManager.address);
    
    const ExchangeFactory = await ethers.getContractFactory("ExchangeManager");
    exchangeManager = await ExchangeFactory.deploy("0x1337DEF1FC06783D4b03CB8C1Bf3EBf7D0593FC4", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0x0d438F3b5175Bebc262bF23753C1E53d03432bDE","0x01bfd82675dbcc7762c84019ca518e701c0cd07e", "0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd", "0x7a250d5630b4cf539739df2c5dacb4c659f2488d", "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f");
    await exchangeManager.initialize(master.address);
    
    const kycAuthAddress = "0x176c27973e0229501d049de626d50918dda24656";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [kycAuthAddress]}
    );
    const memberRoles = await ethers.getContractAt("IMemberRoles", "0x055CC48f7968FD8640EF140610dd4038e1b03926");
    await memberRoles.payJoiningFee(exchangeManager.address,{value: 2000000000000000});
    const auth = await ethers.provider.getSigner(kycAuthAddress);
    await memberRoles.connect(auth).kycVerdict(exchangeManager.address, true);
  });

  describe("uni", function(){
    const amount = BigNumber.from("1000000000000000000");
    beforeEach(async function(){
      await claimManager.mockDeposit({value:amount});
    });
    it('should fail if msg.sender is not owner', async function(){
      await expect(exchangeManager.connect(user).buyWNxmUni(amount,1,["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0x0d438F3b5175Bebc262bF23753C1E53d03432bDE"])).to.be.reverted;
    });
    it('should be able to exchange ether to wnxm', async function(){
      const TokenFactory = await ethers.getContractFactory("ERC20Mock");
      token = await TokenFactory.attach("0xd7c49cee7e9188cca6ad8ff264c1da2e69d4cf3b");
      const before =await token.balanceOf("0x1337DEF1FC06783D4b03CB8C1Bf3EBf7D0593FC4");
      await exchangeManager.connect(owner).buyWNxmUni(amount,1,["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0x0d438F3b5175Bebc262bF23753C1E53d03432bDE"]);
      const after = await token.balanceOf("0x1337DEF1FC06783D4b03CB8C1Bf3EBf7D0593FC4");
      console.log(before.toString());
      console.log(after.toString());
    });
  });
  describe("sushi", function(){
    const amount = BigNumber.from("1000000000000000000");
    beforeEach(async function(){
      await claimManager.mockDeposit({value:amount});
    });
    it('should fail if msg.sender is not owner', async function(){
      await expect(exchangeManager.connect(user).buyWNxmSushi(amount,1,["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0x0d438F3b5175Bebc262bF23753C1E53d03432bDE"])).to.be.reverted;
    });
    it('should be able to exchange ether to wnxm', async function(){
      const TokenFactory = await ethers.getContractFactory("ERC20Mock");
      token = await TokenFactory.attach("0xd7c49cee7e9188cca6ad8ff264c1da2e69d4cf3b");
      const before =await token.balanceOf("0x1337DEF1FC06783D4b03CB8C1Bf3EBf7D0593FC4");
      await exchangeManager.connect(owner).buyWNxmSushi(amount,1,["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0x0d438F3b5175Bebc262bF23753C1E53d03432bDE"]);
      const after = await token.balanceOf("0x1337DEF1FC06783D4b03CB8C1Bf3EBf7D0593FC4");
      console.log(before.toString());
      console.log(after.toString());
    });
  });
  describe("bal", function(){
    const amount = BigNumber.from("1000000000000000000");
    beforeEach(async function(){
      await claimManager.mockDeposit({value:amount});
    });
    it('should fail if msg.sender is not owner', async function(){
      await expect(exchangeManager.connect(user).buyWNxmBalancer(amount,"0xe0da0a98e004b69acb9bc0cce83979c76d124ed1", 1, constants.MaxUint256)).to.be.reverted;
    });
    it('should be able to exchange ether to wnxm', async function(){
      const TokenFactory = await ethers.getContractFactory("ERC20Mock");
      token = await TokenFactory.attach("0xd7c49cee7e9188cca6ad8ff264c1da2e69d4cf3b");
      const before =await token.balanceOf("0x1337DEF1FC06783D4b03CB8C1Bf3EBf7D0593FC4");
      await exchangeManager.connect(owner).buyWNxmBalancer(amount,"0xe0da0a98e004b69acb9bc0cce83979c76d124ed1", 1, constants.MaxUint256);
      const after = await token.balanceOf("0x1337DEF1FC06783D4b03CB8C1Bf3EBf7D0593FC4");
      console.log(before.toString());
      console.log(after.toString());
    });
  });
  describe("nxm", function(){
    const amount = BigNumber.from("1000000000000000000");
    beforeEach(async function(){
      await claimManager.mockDeposit({value:amount});
    });
    it('should fail if msg.sender is not owner', async function(){
      await expect(exchangeManager.connect(user).buyNxm(amount, 1)).to.be.reverted;
    });
    it('should be able to exchange ether to wnxm', async function(){
      const TokenFactory = await ethers.getContractFactory("ERC20Mock");
      token = await TokenFactory.attach("0xd7c49cee7e9188cca6ad8ff264c1da2e69d4cf3b");
      const before =await token.balanceOf("0x1337DEF1FC06783D4b03CB8C1Bf3EBf7D0593FC4");
      await exchangeManager.connect(owner).buyNxm(amount, 1);
      const after = await token.balanceOf("0x1337DEF1FC06783D4b03CB8C1Bf3EBf7D0593FC4");
      console.log(before.toString());
      console.log(after.toString());
    });
  });
});
