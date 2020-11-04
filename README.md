# Armor Core

Intro
Armor enables users to purchase p2p coverage for funds held on protected smart contracts without micro-managing cover value or expirations with a very simple experience. With our novel “pay-as-you-go” system, a user can partially “rent” a coverage contract underwritten by Nexus Mutual and only ever pay for the amount of time or cover value that is being used. This system also allows your protection to be seamlessly adjusted to suit your currently deployed allocations between platforms when you move funds, and for you to easily be protected on many contracts in one easy and simple step.

Selling
Stakers are the sellers of the Armor protocol. They provide the backbone of Armor by Staking their arNFTs that can then be used to provide coverage for a borrower’s assets. These arNFT tokens provide coverage on any smart contract that is able to be protected by Nexus Mutual. When these tokens are Staked to our system, they are pooled and subsequently “rented” out to borrowers based on the coverage provided and cost of that coverage. In return for allowing us to rent out these tokens, Stakers are rewarded with a portion of fees from borrowers, generating a return over the lifetime of their Staked arNFT based on the proportional value of rented coverage.

Buying
Borrowers are the customers of the Armor protocol. A borrower deposits funds into the Armor contracts to protect assets they hold across any Nexus Mutual-protected platform. Our smart contracts calculate the price per second that it will cost to protect the buyer’s assets across all platforms they require protection on, then upon approval by the user, stream the borrower’s payments based on that. The borrower does not have to pay any money to begin their protection and only pays for exactly the assets they have agreed to cover and only for the amount of time they need coverage. The payment for this protection then goes to Armor’s treasury where it is exchanged then redistributed between Stakers and ARMOR token-holders.

Some Numbers
When a Staker stakes their arNFT and it is rented to Borrowers, the Staker is paid a percentage of the borrower fees used for coverage. 
The fees are used to buy ARMOR on the open market. These ARMOR tokens are then deposited to the Staking smart contract for distribution to Stakers, who can claim their accrued rewards from the faucet at any time. 
Each day this deposit of ARMOR is made to the Staking smart contract and the Staker gains a share of this deposit corresponding to the share of the total Staked cost at the moment.
For example, if a Staker has deposited an arNFT of $10 and the full system for the covered protocol following Staker deposit of $10 now has arNFTs totaling $100 Staked (for example for Uniswap V2), the Staker will be rewarded with 10% of the fees made that day for Uniswap V2 borrows. Day as a unit of measure is for example. This will all actually be calculated by the second. Of a given pool in a certain block, what fees were collected in that block, and is distributed appropriately.
This system ensures Stakers are rewarded only according to the utility they have provided the protocol.
As a borrower uses the system, they pay a premium of 2x the market cost of the coverage they want in a per-block billing schedule. This premium is used to reward the Stakers and ARMOR token holders, and to finance the operating costs of the Armor system.
Given this premium, a fully-utilized system where Staked coverage is fully borrowed would guarantee to return to the Staker a greater value of ARMOR than their arNFT cost. Because Stakers get 80% of borrower funds paid to the system, their returns will look like:
x = cover cost of Staked arNFTs
y = Staker amount in the pool
z = full pool amount

r = (x * 2 * 0.8) * ( y / z)

If a user has a $10 stake, the pool has a total of $100, and the buyer coverage matches the pool coverage, this equation will look like:

r = (100 * 2 * 0.8) * (10 / 100)

Which means the return a user will receive for Staking $10 is $16.

This can be decided on the fly as, at the beginning, we have control of the funds to be sent to RewardManager.



Smart Contracts

All core smart contracts of the Armor protocol.


BalanceManager

The Balance Manager keeps track of borrower funds. Users deposit funds for coverage they select based on first an automated recommendation in the UX which they can then either proceed with as recommended or manually adjust, then on confirmation via signature or on-chain transaction, then their balance is “streamed” down, making the system completely pay-as-you-go. When a user selects coverage (through the Plan Manager), the cost of that coverage is calculated, then the ETH price per second is sent to the Balance Manager. This strategy allows users to pay for only the exact length of coverage they need.

External Functions:

deposit(uint256 _amount): Deposits the desired amount of Dai to the sender’s account. The sender must first approve the Balance Manager to withdraw the Dai before they can send the deposit transaction. Updates user balance to the current amount after streaming since the last amount.

withdraw(uint256 _amount): Withdraws the desired amount of Dai from the sender’s account. Withdraw also updates the Users balance.


PlanManager
Plan Manager keeps track of all plans that users have. This includes a list of protocols, the amount of coverage for each protocol, then the start time and end time of the current plan. End time is calculated by determining the length of time the current Users balance can pay for the desired coverage. If user balance increases or decreases, plan length adjusts to suit. If covered protocols change or if a plan has ended and is now being renewed, a new plan struct is added to a list of the Users plans, providing a full history of exactly what coverage the user had at which times.

External Functions:

updatePlan(address[] _protocols, uint256[] _coverAmounts): Updates a user plan to new values in case a Users coverage has changed. This update will calculate how much the plan will cost, when the plan will end, then save it to the Users plans. The _protocols and _coverAmounts variables must be of equal length. _protocols is the list of platforms they want coverage for.. _coverAmounts is the amount of currency the user wants to protect on each protocol in a 0 decimal format. Of course, these lists must be ordered so that _protocols[i] is the protocol that is being covered for _coverAmounts[i].

checkCoverage(address _user, address _protocol, uint256 _hackTime): Check coverage is written to allow ClaimManager to be able to easily tell if a user had coverage at the time a hack happened (if coverage expired after a hack occured, claims must be made within 30 days of coverage expiry), but it may also be used by the frontend when determining if a user should be shown that they are able to claim funds after a hack has happened. It loops through user plans--from newest to oldest--, checks whether _user had coverage for _protocol at _hackTime, then returns the amount of coverage they had. It will return 0 if the user had no coverage at the time. _protocol, again, is the hash of the protocol smart contract address and cover currency signature. _hackTime is a Unix timestamp.


ClaimManager

The Claim Manager smart contract controls all functionality in regards to arNFT claims when a protocol is hacked. ClaimManager allows the owner (soon to be decentralized governance) to input that a hack of a certain protocol happened at a certain time. arNFTs can then be submitted to Nexus Mutual to begin the claim process. Users can then redeem a claim, which will check whether they had coverage at the time a hack happened, then return them the amount that had been covered. Users can redeem a claim as soon as a hack time and protocol have been input--they do not need to wait for arNFT claims to be submitted and redeemed. This makes redeeming happen on a “first come, first served” basis, but once all arNFT claims have gone through, the contract will have the funds for every protected user to claim.


External Functions:

confirmHack(address _protocol, uint256 _hackTime) onlyOwner: Owner of the contract submits the protocol that was hacked and the time that the hack happened. This data is then saved in a mapping of confirmed hacks.

submitNft(uint256 _nftId, address _protocol, uint256 _hackTime): Submits an NFT to Nexus Mutual for their decentralized governance to decide whether it is a valid claim. This can only be called after the owner of the contract has confirmed a hack of the protocol at the given hack time, but anyone can call this function at that time. _nftId is the ID of the nft to submit, _protocol is the keccak256 hash of protocol address and cover currency, _hackTime is the Unix timestamp of when the hack happened.

redeemNft(uint256 _nftId): After Nexus Mutual has accepted a submitted claim, this function is called to pull funds from Nexus Mutual to this contract so that users can withdraw their claim.

redeemClaim(address _protocol, uint256 _hackTime): Users can call this function to withdraw funds if they had coverage at the time of a hack. _protocol is the hash previously described, _hackTime is a Unix timestamp.
 

StakeManager 
The Stake Manager contract is where the Staking of arNFTs takes place. It allows users to stake, keeps track of total amounts Staked for each protocol, and contains functionality to remove expired NFTs. Staked NFTs cannot be withdrawn.

External Functions:

stakeNft(uint256 _nftId): User can stake an NFT. They must first approve StakeManager to transfer the NFT. The NFT is transferred directly to ClaimManager. _nftId is the Id of the NFT.

batchStakeNft(uint256[] _nftIds): Same as stakeNft but a user may stake multiple at once. Same variable as above but in arrays. The arrays must be of equal length and each index must correlate to the others’.

removeExpiredNft(uint256 _nftId): removeExpiredNft allows anyone to remove an NFT that has reached its expiration time. Most functions in the system automatically call this to remove expired NFTs so use of the system will work for upkeep here and this will rarely need to be called directly. This lowers total Staked cover for the protocol and removes stake from the user. _nftId is the ID of the NFT that has expired.

allowedCover(address _protocol, uint256 _totalBorrowedCover): allowedCover is called by the PlanManager contract to determine whether a new plan should be allowed to be bought. We do not want borrowers to have more coverage than is currently being Staked, so we must restrict them to the cover that is currently Staked. _protocol is the hash as described previously. _totalBorrowedCover is the total amount of cover that has been borrowed (this variable exists on the PlanManager contract is it is input here. Returns bool of whether the coverage to be borrowed should be allowed.

RewardManager
The Reward Manager contract keeps track of all rewards owed to the Stakers of the system. Rewards come from the funds paid by borrowers that are sent to the Armor treasury, then deposited into the contract every 24 hours. These rewards are then given to Stakers based on their share of the amount of coverage currently Staked.

External Functions:

withdraw(uint256 _amount): Allows a Staker to withdraw the rewards they currently have in the contract.

deposit(uint256 _amount) onlyOwner: Allows the owner of the contract to deposit the ARMOR that will then be rewarded to Stakers. Owner must approve this contract to transfer their ARMOR before calling this.

balanceOf(address _user): Allows frontend to check what the current reward balance of a user is. Returns an 18 decimal amount of Armor tokens.
