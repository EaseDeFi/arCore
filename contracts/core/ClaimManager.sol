// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

import '../general/ArmorModule.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IERC721.sol';
import '../interfaces/IarNFT.sol';
import '../interfaces/IPlanManager.sol';
import '../interfaces/IStakeManager.sol';
import '../interfaces/IClaimManager.sol';
/**
 * @dev This contract holds all NFTs. The only time it does something is if a user requests a claim.
 * @notice We need to make sure a user can only claim when they have balance.
**/
contract ClaimManager is ArmorModule, IClaimManager {
    bytes4 public constant ETH_SIG = bytes4(0x45544800);

    // Mapping of hacks that we have confirmed to have happened. (keccak256(protocol ID, timestamp) => didithappen).
    mapping (bytes32 => bool) confirmedHacks;
    
    // Emitted when a new hack has been recorded.
    event ConfirmedHack(bytes32 indexed hackId, address indexed protocol, uint256 timestamp);
    
    // Emitted when a user successfully receives a payout.
    event ClaimPayout(bytes32 indexed hackId, address indexed user, uint256 amount);

    // for receiving redeemed ether
    receive() external payable {
    }
    
    /**
     * @dev Start the contract off by giving it the address of Nexus Mutual to submit a claim.
    **/
    function initialize(address _armorMaster)
      public
      override
    {
        initializeModule(_armorMaster);
    }
    
    /**
     * @dev User requests claim based on a loss.
     *      Do we want this to be callable by anyone or only the person requesting?
     *      Proof-of-Loss must be implemented here.
     * @param _hackTime The given timestamp for when the hack occurred.
     * @notice Make sure this cannot be done twice. I also think this protocol interaction can be simplified.
    **/
    function redeemClaim(address _protocol, uint256 _hackTime, uint256 _amount)
      external
      doKeep
    {
        bytes32 hackId = keccak256(abi.encodePacked(_protocol, _hackTime));
        require(confirmedHacks[hackId], "No hack with these parameters has been confirmed.");
        
        // Gets the coverage amount of the user at the time the hack happened.
        // TODO check if plan is not active now => to prevent users paying more than needed
        (uint256 planIndex, bool covered) = IPlanManager(getModule("PLAN")).checkCoverage(msg.sender, _protocol, _hackTime, _amount);
        require(covered, "User does not have valid amount, check path and amount");
        
        IPlanManager(getModule("PLAN")).planRedeemed(msg.sender, planIndex, _protocol);
        msg.sender.transfer(_amount);
        
        emit ClaimPayout(hackId, msg.sender, _amount);
    }
    
    /**
     * @dev Submit any NFT that was active at the time of a hack on its protocol.
     * @param _nftId ID of the NFT to submit.
     * @param _hackTime The timestamp of the hack that occurred. Hacktime is the START of the hack if not a single tx.
    **/
    function submitNft(uint256 _nftId,uint256 _hackTime)
      external
      doKeep
    {
        (/*cid*/, uint8 status, uint256 sumAssured, uint16 coverPeriod, uint256 validUntil, address scAddress,
        bytes4 currencyCode, /*premiumNXM*/, /*coverPrice*/, /*claimId*/) = IarNFT(getModule("ARNFT")).getToken(_nftId);
        bytes32 hackId = keccak256(abi.encodePacked(scAddress, _hackTime));
        
        require(confirmedHacks[hackId], "No hack with these parameters has been confirmed.");
        require(currencyCode == ETH_SIG, "Only ETH nft can be submitted");
        
        // Make sure arNFT was active at the time
        require(validUntil >= _hackTime, "arNFT was not valid at time of hack.");
        
        // Make sure NFT was purchased before hack.
        uint256 generationTime = validUntil - (uint256(coverPeriod) * 1 days);
        require(generationTime <= _hackTime, "arNFT had not been purchased before hack.");

        // Subtract amount it was protecting from total staked for the protocol if it is not expired (in which case it already has been subtracted).
        uint256 weiSumAssured = sumAssured * (1e18);
        if (status != 3) IStakeManager(getModule("STAKE")).subtractTotal(_nftId, scAddress, weiSumAssured);
        // subtract balance here

        IarNFT(getModule("ARNFT")).submitClaim(_nftId);
    }
    
    /**
     * @dev Calls the arNFT contract to redeem a claim (receive funds) if it has been accepted.
     *      This is callable by anyone without any checks--either we receive money or it reverts.
     * @param _nftId The ID of the yNft token.
    **/
    function redeemNft(uint256 _nftId)
      external
      doKeep
    {
        IarNFT(getModule("ARNFT")).redeemClaim(_nftId);
    }
    
    /**
     * @dev Used by StakeManager in case a user wants to withdraw their NFT.
     * @param _to Address to send the NFT to.
     * @param _nftId ID of the NFT to be withdrawn.
    **/
    function transferNft(address _to, uint256 _nftId)
      external
      override
      onlyModule("STAKE")
    {
        IarNFT(getModule("ARNFT")).safeTransferFrom(address(this), _to, _nftId);
    }
    
    /**
     * @dev Called by Armor for now--we confirm a hack happened and give a timestamp for what time it was.
     * @param _protocol The address of the protocol that has been hacked (address that would be on yNFT).
     * @param _hackTime The timestamp of the time the hack occurred.
    **/
    function confirmHack(address _protocol, uint256 _hackTime)
      external
      onlyOwner
    {
        require(_hackTime < now, "Cannot confirm future");
        bytes32 hackId = keccak256(abi.encodePacked(_protocol, _hackTime));
        confirmedHacks[hackId] = true;
        emit ConfirmedHack(hackId, _protocol, _hackTime);
    }
}
