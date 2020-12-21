import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
describe.only("ArmorMaster", function () {
  let accounts: Signer[];
  let armorMaster: Contract;
  let armorModule: Contract;
  let user: Signer;
  let dev: Signer;
  let owner: Signer;
  let key = ethers.utils.formatBytes32String("KEY");
  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];
    const MasterFactory = await ethers.getContractFactory("ArmorMaster");
    armorMaster = await MasterFactory.deploy();
    await armorMaster.connect(owner).initialize();
  });

  describe("#initialize()", function(){
    it("should fail if already initialized", async function(){
      await expect(armorMaster.initialize()).to.be.revertedWith("already initialized");
    });
  });

  describe("#registerModule()", function(){
    it("should fail if msg.sender is not owner", async function(){
      const ModuleFactory = await ethers.getContractFactory("ArmorModuleMock");
      armorModule = await ModuleFactory.deploy(armorMaster.address);
      await expect(armorMaster.connect(user).registerModule(key,armorModule.address)).to.be.revertedWith("msg.sender is not owner");
    });

    it("should update module", async function(){
      const ModuleFactory = await ethers.getContractFactory("ArmorModuleMock");
      armorModule = await ModuleFactory.deploy(armorMaster.address);
      await armorMaster.connect(owner).registerModule(key,armorModule.address);
      let check = await armorMaster.getModule(key);
      expect(check).to.be.equal(armorModule.address);
    });
  });

  describe("#addJob()", function(){
    beforeEach(async function(){
      const ModuleFactory = await ethers.getContractFactory("ArmorModuleMock");
      armorModule = await ModuleFactory.deploy(armorMaster.address);
      await armorMaster.connect(owner).registerModule(key,armorModule.address);
    });
    it("should fail if msg.sender is not owner", async function(){
      await expect(armorMaster.connect(user).addJob(key)).to.be.revertedWith("msg.sender is not owner");
    });
    it("should fail if job count is larger than 2", async function(){
      const ModuleFactory = await ethers.getContractFactory("ArmorModuleMock");
      for(let i = 0;i<3; i++){
        armorModule = await ModuleFactory.deploy(armorMaster.address);
        let key_temp = ethers.utils.formatBytes32String("KEY"+i);
        await armorMaster.connect(owner).registerModule(key_temp, armorModule.address);
        await armorMaster.connect(owner).addJob(key_temp);
      }
      armorModule = await ModuleFactory.deploy(armorMaster.address);
      let key_temp = ethers.utils.formatBytes32String("FAIL");
      await armorMaster.connect(owner).registerModule(key_temp, armorModule.address);
      await expect(armorMaster.connect(owner).addJob(key_temp)).to.be.revertedWith("cannot have more than 3 jobs");
    });
    it("should fail if module is not registered", async function(){
      let key_temp = ethers.utils.formatBytes32String("FAIL");
      await expect(armorMaster.connect(owner).addJob(key_temp)).to.be.revertedWith("module is not listed");
    });
    it("should fail if module is already registerd as job", async function(){
        await armorMaster.connect(owner).addJob(key);
        await expect(armorMaster.connect(owner).addJob(key)).to.be.revertedWith("already registered");
    });
  });

  describe("#deleteJob()", function(){
    beforeEach(async function(){
      const ModuleFactory = await ethers.getContractFactory("ArmorModuleMock");
      armorModule = await ModuleFactory.deploy(armorMaster.address);
      await armorMaster.connect(owner).registerModule(key,armorModule.address);
      await armorMaster.connect(owner).addJob(key);
    });

    it("should fail if msg.sender is not owner", async function(){
      await expect(armorMaster.connect(user).deleteJob(key)).to.be.revertedWith("msg.sender is not owner");
    });

    it("should fail if module is not registered as job", async function(){
      let key_temp = ethers.utils.formatBytes32String("FAIL");
      await expect(armorMaster.connect(owner).deleteJob(key_temp)).to.be.revertedWith("job not found");
    });

    it("should delete from job", async function(){
      const before = await armorMaster.jobs();
      await armorMaster.connect(owner).deleteJob(key);
      const list = await armorMaster.jobs();
      expect(list.length).to.be.equal(before.length - 1);
    });
  });

  describe("#keep()", function(){
    beforeEach(async function(){
      const ModuleFactory = await ethers.getContractFactory("ArmorModuleMock");
      armorModule = await ModuleFactory.deploy(armorMaster.address);
      await armorMaster.connect(owner).registerModule(key,armorModule.address);
    });

    it("should call keep", async function(){
      await armorMaster.connect(owner).addJob(key);
      await armorMaster.keep();
      expect((await armorModule.counter()).toString()).to.be.equal(BigNumber.from(1).toString());
    });

    it("should not fail", async function(){
      await armorMaster.keep();
    });
  });
});
