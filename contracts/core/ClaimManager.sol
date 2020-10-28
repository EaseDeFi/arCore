pragma solidity ^0.6.6;

import '../general/Ownable.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IERC721.sol';
import '../interfaces/IarNFT.sol';
import './PlanManager.sol';

/**
 * @dev This contract holds all NFTs. The only time it does something is if a user requests a claim.
 * @notice We need to make sure a user can only claim when they have balance.
**/
contract ClaimManager is Ownable {
    bytes4 public constant ETH_SIG = bytes4(0x45544800);

    PlanManager public planManager;

    IarNFT public arNFT;

    // Mapping of hacks that we have confirmed to have happened. (keccak256(protocol ID, timestamp) => didithappen).
    mapping (bytes32 => bool) confirmedHacks;
    
    // Emitted when a new hack has been recorded.
    event ConfirmedHack(bytes32 indexed hackId, address indexed protocol, uint256 timestamp);

    // Emitted when a user successfully receives a payout.
    event ClaimPayout(bytes32 indexed hackId, address indexed user, uint256 amount);
    
    /**
     * @dev Start the contract off by giving it the address of Nexus Mutual to submit a claim.
     * @dev _planManager Address of the PlanManager Armor contract.
     * @dev __arNFT Address of the arNFT contract.
    **/
    constructor(address _planManager, address _arNFT)
      public
    {
        planManager = PlanManager(_planManager);
        arNFT = IarNFT(_arNFT);
    }
    
    /**
     * @dev User requests claim based on a loss.
     *      Do we want this to be callable by anyone or only the person requesting?
     *      Proof-of-Loss must be implemented here.
     * @param _hackTime The given timestamp for when the hack occurred.
     * @notice Make sure this cannot be done twice. I also think this protocol interaction can be simplified.
    **/
    function redeemClaim(address _protocol, uint256 _hackTime)
      external
    {
        bytes32 hackId = keccak256(abi.encodePacked(_protocol, _hackTime));
        require(confirmedHacks[hackId], "No hack with these parameters has been confirmed.");
        
        // Gets the coverage amount of the user at the time the hack happened.
        uint256 coverage = planManager.checkCoverage(msg.sender, _protocol, _hackTime);
        
        require(coverage > 0, "User had no coverage at the time of this hack.");
    
        // Put Ether into 18 decimal format.
        uint256 payment = coverage * 10 ** 18;

        msg.sender.transfer(payment);

        emit ClaimPayout(hackId, msg.sender, coverage);
    }
    
    /**
     * @dev Submit any NFT that was active at the time of a hack on its protocol.
     * @param _nftId ID of the NFT to submit.
     * @param _protocol Address of the protocol the hack occurred on.
     * @param _hackTime The timestamp of the hack that occurred.
     * @notice I think this _protocol/_protocolAddress use can be simplified.
    **/
    function submitNft(uint256 _nftId, address _protocol, uint256 _hackTime)
      external
    {
        bytes32 hackId = keccak256(abi.encodePacked(_protocol, _hackTime));
        require(confirmedHacks[hackId], "No hack with these parameters has been confirmed.");

        (/*cid*/, uint8 status, /*sumAssured*/, /*coverPeriod*/, uint256 validUntil, address scAddress,
         /*currencyCode*/, /*premiumNXM*/, /*coverPrice*/, /*claimId*/) = arNFT.getToken(_nftId);

        // Call arNFT to ensure token had not been claimed
        // Status must be Active, ClaimDenied, or CoverExpired.
        require(status == 0 || status == 2 || status == 3);
        
        // Make sure arNFT was active at the time
        require(validUntil >= _hackTime, "arNFT was not valid at time of hack.");

        // Make sure arNFT protocol matches
        require(scAddress == _protocol, "arNFT does not cover correct protocol.");

        arNFT.submitClaim(_nftId);
    }
    
    /**
     * @dev Calls the arNFT contract to redeem a claim (receive funds) if it has been accepted.
     *      This is callable by anyone without any checks--either we receive money or it reverts.
     * @param _nftId The ID of the yNft token.
    **/
    function redeemNft(uint256 _nftId)
      external
    {
        arNFT.redeemClaim(_nftId);
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
        bytes32 hackId = keccak256(abi.encodePacked(_protocol, _hackTime));
        confirmedHacks[hackId] = true;
        
        emit ConfirmedHack(hackId, _protocol, _hackTime);
    }
    
}
