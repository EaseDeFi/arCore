import axios from "axios";
import { BigNumber } from "ethers";
export async function manualUpdate(hre: any, threshold: string) {
  const network = await hre.network.provider.request({
    method: "net_version", params: [], id: 100}
  );
  const thegraph = "https://api.thegraph.com/subgraphs/name/leekt/armor-balance-manager";
  const query = `query($last: BigInt){balances(orderBy: perSecondPrice, orderDirection: desc, where: {perSecondPrice_gt:"0", lastTime_lte:$last}) {id lastBalance lastTime perSecondPrice}}`;
  const timestamp = Math.floor(Date.now()/1000);
  const data = await axios.post(thegraph, {
    query: query,
    variables:{
      last: timestamp - 86400 // to prevent more than calling more than 1 time a day
    }
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  const balances = data.data.data.balances;
  let targets = [];
  const filtered = balances.filter( x => {
    const diff = timestamp - x.lastTime;
    const decay = BigNumber.from(`${diff * x.perSecondPrice}`);
    if(decay.gte(hre.ethers.utils.parseEther(threshold))) {
      console.log(`Found ${x.id} has decaying balance of ${hre.ethers.utils.formatUnits(decay)}`);
      targets.push(x.id);
    }
  });
  if(targets.length == 0) {
    console.log("No address is target for manual update");
  } else {
    // call manual update
    const addr = "0x1337DEF1c5EbBd9840E6B25C4438E829555395AA";
    const balanceManager = await hre.ethers.getContractAt("BalanceManager", addr);
    const keeperAddr = await balanceManager.armorKeeper();
    if(network === "31337"){
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [keeperAddr]
      });
    }
    const keeper = await hre.ethers.getSigner(keeperAddr);
    const gas = await balanceManager.connect(keeper).estimateGas.manualUpdate(targets);
    console.log(gas.toNumber());
  }
}
