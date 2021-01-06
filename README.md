# Armor Core

Armor Core allows users to buy cover for funds held on various DeFi protocols that will allow compensation in case the protocol is hacked. All cover is underwritten by Nexus Mutual. This cover is dynamic so it will be updated any time a user transfer funds to or from the protocol and it is pay-as-you-go, so a user only ever pays for the exact amount of cover needed. 
<br>
<br>
## ArmorMaster

The ArmorMaster contract keeps track of modules and jobs within the Armor Core system. Each contract (BalanceManager, ClaimManager, PlanManager, RewardManager, and StakeManager) are registered on it so that they can easily get each other’s addresses.
<br>
There are also “jobs” on ArmorMaster, which, when enabled, will be called by the doKeep modifiers to perform maintenance functions. At the moment these maintenance functions include expiring balances and expiring NFTs.
<br>
<br>
## BalanceManager

The BalanceManager contract keeps track of all borrower balances. It takes in Ether, is given a plans cost (per second) by the PlanManager, then charges users per second for the plan they hold. When charged, a percent of the funds charged may also be given to the developer, governance contract, or referrer of the user. The rest of the funds are then sent to RewardManager to be disbursed to stakers of the NFTs.

## RewardManager

The RewardManager contract is used to disburse funds to stakers after users pay for their plans. When a user stakes an NFT, their recorded stake on RewardManager increases. When their NFT expires or is withdrawn, their recorded stake on RewardManager decreases. BalanceManager then sends funds to RewardManager, and they are dripped to stakers pro rata.

## StakeManager

The StakeManager contract accepts NFTs that can then be lent out to borrowers. A user stakes their NFT, the NFT price is recorded, and they then receive rewards from RewardManager based on how much they paid for the NFT.
<br>
NFTs may be withdrawn, but only after a 7 day withdrawal delay.

## PlanManager

The PlanManager contract keeps track of all user plans. A user submits an array of protocol addresses to stake in and an array of amounts to borrow, then they are assigned that amount of coverage and the price of their plan is updated on BalanceManager.

## ClaimManager

The ClaimManager contract takes care of any claims that may be made in the case of a hack. When a hack happens, the owner of the contract must submit a verification of the time and protocol, then NFTs that were active at that time may be submitted to Nexus Mutual through the arNFT contract.
<br>
After an NFT submission is accepted, if a user had coverage on that protocol at that time, they may then withdraw the full amount of coverage they had been paying for.
<br>
<br>
More information is available at https://armorfi.gitbook.io/armor/products/arcore
