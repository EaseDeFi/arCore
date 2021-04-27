import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { increase } from "../utils";
describe("ArmorMaster", function () {
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

  describe.skip("#work()", function(){
    const KEEP3R_GOV = "0x0d5dc686d0a2abbfdafdfb4d0533e886517d4e83";
    const KEEP3R_WHALE = "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be";
    const KEEP3R = "0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44";
    let keep3rgov : Signer;
    let keep3r : Contract;
    let worker: Signer;
    beforeEach(async function(){
      worker = accounts[7];
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [KEEP3R_GOV]
      });
      keep3rgov = await ethers.provider.getSigner(KEEP3R_GOV);
      keep3r = await ethers.getContractAt("Keep3rV1", KEEP3R);
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [KEEP3R_WHALE]
      });
      const whale = await ethers.provider.getSigner(KEEP3R_WHALE);
      /// become keep3r
      await keep3r.connect(whale).transfer(worker.getAddress(), BigNumber.from("10000000000000000000"));
      await keep3r.connect(worker).bond(KEEP3R, BigNumber.from("10000000000000000000"));
      await increase(259200 + 10000);
      await keep3r.connect(worker).activate(KEEP3R);

      await owner.sendTransaction({to:KEEP3R_GOV, value:BigNumber.from("1000000000000000000")});
      const ModuleFactory = await ethers.getContractFactory("ArmorModuleMock");
      armorModule = await ModuleFactory.deploy(armorMaster.address);
      await armorMaster.connect(owner).registerModule(key,armorModule.address);
      await keep3r.connect(keep3rgov).addJob(armorMaster.address);
      /// add credit
      await keep3r.connect(whale).approve(KEEP3R, BigNumber.from("10000000000000000000"));
      await keep3r.connect(whale).addCredit(KEEP3R, armorMaster.address,BigNumber.from("10000000000000000000")); 
    });
    it("can work", async function(){
      await armorMaster.connect(worker).work([key],[1]);
    });
    it("should increase keep3r balance", async function(){
      const balance = await keep3r.balanceOf(worker.getAddress());
      await armorMaster.connect(worker).work([key],[1]);
      const after = await keep3r.balanceOf(worker.getAddress());
      expect(after).to.gt(balance);
      //console.log(after.toString());
    });
  });
});
