import { ethers } from "hardhat";
import { providers, Contract, Signer, BigNumber } from "ethers";

export function ether(amount: string) : BigNumber {
  return ethers.utils.parseEther(amount);
}

export async function increase(seconds: number) {
  const signers = await ethers.getSigners();
  const signer = signers[0];
  await (signer.provider as providers.JsonRpcProvider).send("evm_increaseTime", [seconds]);
}

export async function getTimestamp() : Promise<BigNumber> {
  const signers = await ethers.getSigners();
  const signer = signers[0];
  const res = await (signer.provider as providers.JsonRpcProvider).send("eth_getBlockByNumber", ["latest", false]);
  return BigNumber.from(res.timestamp);
}
