pragma solidity ^0.6.6;

import '../general/Ownable.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/INexusMutual.sol';

/**
 * @dev This contract holds all NFTs. The only time it does something is if a user requests a claim.
 * @notice We need to make sure a user can only claim when they have balance.
**/
contract ClaimManager is Ownable {
    
    // Next claim ID that will be used when a user submits claim.
    uint256 nextId;
    
    INexusMutual public nexusMutual;
    
    IERC20 public daiContract;
    
    // Mapping of current user claims by ID (this contract's IDs, NOT NexusMutual's).
    mapping (uint256 => Claim) claims;
    
    // Emitted when a user submits a request to make a claim.
    event ClaimRequested(uint256 id, address indexed user, uint256 amount);
    
    // Emitted when a user is approved to withdraw funds from this contract.
    event ClaimApproved(uint256 id, address indexed user, uint256 amount);
    
    // Claim submitted by a user.
    struct Claim {
        address user;
        uint256 amount;
        bool approved;
    }
    
    
    /**
     * @dev Start the contract off by giving it the address of Nexus Mutual to submit a claim.
     * @dev _nexusMutual Address of the Nexus Mutual contract.
     * @dev _daiContract Address of the Dai contract.
    **/
    constructor(address _nexusMutual, address _daiContract)
      public
    {
        nexusMutual = INexusMutual(_nexusMutual);
        daiContract = IERC20(_daiContract);
    }
    
    /**
     * @dev User requests claim based on a loss.
     * @param _amount The amount being requested in the claim.
    **/
    function requestClaim(uint256 _amount)
      external
    {
        uint256 claimId = nextId;
        nextId++;
        
        Claim memory claim = Claim(msg.sender, _amount, false);
        emit ClaimRequested(claimId, msg.sender, _amount);
    }
    
    /**
     * @dev A user can withdraw once the amount has been approved for withdrawal.
     * @param _claimId The ID on our contract of the user's claim.
    **/
    function withdraw(uint256 _claimId)
      external
    {
        Claim memory claim = claims[_claimId];
        require(claim.user != address(0), "Claim does not exist.");
        
        require(daiContract.transfer(claim.user, claim.amount), "Dai withdrawal transfer failed.");
        delete claims[_claimId];
    }
    
    /**
     * @dev Armor approves claim request and sends to NXM.
     * @param _nftId The NFT to send to claim with NexusMutual.
     * @param _claimId ID (on our contract) of the claim being made.
     * @param _user The user whose claim is being approved (they can then withdraw payment).
    **/
    function approveClaim(uint256 _nftId, uint256 _claimId, address _user) 
      external
      onlyOwner
    {
        Claim memory claim = claims[_claimId];
        require(claim.user != address(0), "Claim does not exist.");
        
        // Submit actual Nexus Mutual claim.
        if (_nftId != 0) nexusMutual.submitClaim(_nftId);
        
        claims[_claimId].approved = true;
        emit ClaimApproved(_claimId, _user, claim.amount);
    }
    
    /**
     * @dev Redeems a successful claim. Only called by owner, gets funds.
     * @param _nxmClaimId The ID of the claim being redeemed.
     * @notice The function `redeemClaim` isn't even real, need to adjust to the contract.
    **/
    function redeemClaim(uint256 _nxmClaimId)
      external
      onlyOwner
    {
        nexusMutual.redeemClaim(_nxmClaimId);
    }
    
}
