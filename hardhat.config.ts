import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "solidity-coverage";
import "hardhat-spdx-license-identifier";
import "hardhat-gas-reporter";
import { manualUpdate } from "./scripts/manualUpdate";
import axios from "axios";
// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

task("keep-balance", "Runs balance manager keeper")
  .addParam("threshold", "threshold to call keep, enter eth amount (ex. 0.5 eth => 0.5)")
  .setAction(
    async(taskArgs, hre) => {
      await manualUpdate(hre, taskArgs.threshold);
    });

export default {
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 100,
  },
  spdxLicenseIdentifier: {
    overwrite: false,
    runOnCompile: true,
  },
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      gas: 10000000,
      accounts: {
        accountsBalance: "10000000000000000000000000",
      },
      allowUnlimitedContractSize: true,
      timeout: 1000000,
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/90dtUWHmLmwbYpvIeC53UpAICALKyoIu",
        blockNumber: 13581728
      }
    },
    coverage: {
      url: "http://localhost:8555",
    },
  },
  mocha: {
    timeout: "200000000",
  },
};
