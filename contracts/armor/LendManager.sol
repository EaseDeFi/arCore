pragma solidity ^0.6.6;

import '../general/SafeMath.sol';
import '../interfaces/IToken.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IERC721.sol';
import '../StakeManager.sol';

/**
 * @dev Encompasses all functions taken by stakers.
**/
contract LendManager is IToken {
    
    using SafeMath for uint;
    
    IERC721 public nftContract;
    
    IERC20 public daiContract;
    
    StakeManager public stakeManager;
    
    // All NFTs will be immediately sent to the claim manager.
    address public claimManager;
    
    // The total amount of cover that is currently being staked.
    uint256 totalStakedCover;
    
    // The reward that a 3rd-party bot will get for removing an expired yNFT.
    uint256 expireReward;
    
    // Mapping to keep track of which NFT is owned by whom.
    mapping (uint256 => address) nftOwners;
    
    // Full coverage provided by this user.
    mapping (address => uint256) userCover;
    
    
    /**
     * @dev Construct the contract with the yNFT contract.
     * @param _nftContract Address of the yNFT contract.
    **/
    constructor(address _nftContract, address _stakeManager)
      public
    {
        nftContract = IERC721(_nftContract);
        stakeManager = StakeManager(_stakeManager);
    }
    
    /**
     * @dev stakeNft allows a user to submit their NFT to the contract and begin getting returns.
     *      The NFT cannot be reversed at the moment!
     * @param _nftId The ID of the NFT being staked.
    **/
    function stakeNft(uint256 _nftId)
      public
    {
        // Find user then update their stake before adding a new NFT.
        address user = msg.sender;
        stakeManager.updateStake(user);
        
        _stake(_nftId, user);
    }

    /**
     * @dev stakeNft allows a user to submit their NFT to the contract and begin getting returns.
     *      The NFT cannot be reversed at the moment!
     * @param _nftIds The ID of the NFT being staked.
    **/
    function batchStakeNft(uint256[] memory _nftIds)
      public
    {
        // Find user then update their stake before adding a new NFT.
        address user = msg.sender;
        stakeManager.updateStake(user);

        // Loop through all submitted NFT IDs and stake them.
        for (uint256 i = 0; i < _nftIds.length; i++) {
            _stake(_nftIds[i], user);
        }
    }

    /**
     * @dev removeExpiredNft is used by any 3rd-party bot to remove NFTs that have expired and update coverage amounts.
     *      For this, the dev will be rewarded with an amount of ARMOR that will account for gas costs and a small profit.
     *      This can have more functionality as well if needed.
     * @param _nftId The ID of the expired NFT.
    **/
    function removeExpiredNft(uint256 _nftId)
      external
    {
        /**
         * @notice getNFT doesn't even exist, we need to get this token info correctly...
        **/
        
        // Grab yNFT struct from the ERC21 smart contract.
        Token memory yNft = nftContract.getNFT(_nftId);
        
        address user = nftOwners[_nftId];
        require(user != address(0), "NFT is not on this address.");
        require(_checkNftExpired(yNft), "NFT is not valid.");
        
        stakeManager.updateStake(user);
        _subtractCovers(user, yNft.coverAmount);
        
        require(daiContract.transfer(msg.sender, expireReward), "Reward DAI transfer failed.");
        
        // Returns the caller some gas as well as ensure this function cannot be called again.
        delete nftOwners[_nftId];
    }
    
    /**
     * @dev Getter for user cover amount.
     * @param _user The user who you want to find the cover amount for.
    **/
    function getUserCover(address _user)
      public
      view
    returns (uint256)
    {
        return userCover[_user];
    }
    
    /**
     * @dev Internal function for staking--this allows us to skip updating stake multiple times during a batch stake.
     * @param _nftId The ID of the NFT being staked.
     * @param _user The user who is staking the NFT.
    **/
    function _stake(uint256 _nftId, address _user)
      internal
    {
        Token memory yNft = nftContract.getNFT(_nftId);
        
        require(_checkNftValid(yNft), "NFT is near or past expiry date or is in the process of a claim.");
        
        require(nftContract.transferFrom(_user, claimManager, _nftId), "NFT transfer was unsuccessful.");

        nftOwners[_nftId] = _user;
        _addCovers(_user, yNft.coverAmount);
    }
    
    /**
     * @dev Add to the cover amount for the user and contract overall.
     * @param _user The user who submitted.
     * @param _coverAmount The amount of cover being added.
    **/
    function _addCovers(address _user, uint256 _coverAmount)
      internal
    {
        userCover[_user] = userCover[_user].add(_coverAmount);
        totalStakedCover = totalStakedCover.add(_coverAmount);
    }
    
    /**
     * @dev Subtract from the cover amount for the user and contract overall.
     * @param _user The user who is having the token removed.
     * @param _coverAmount The amount of cover being removed.
    **/
    function _subtractCovers(address _user, uint256 _coverAmount)
      internal
    {
        userCover[_user] = userCover[_user].sub(_coverAmount);
        totalStakedCover = totalStakedCover.sub(_coverAmount);
    }
    
    /**
     * @dev Check that the NFT should be allowed to be added. We check expiry and claimInProgress.
     * @param _yNft The full NFT being dealt with.
    **/
    function _checkNftValid(Token memory _yNft)
      internal
    returns (bool)
    {
        require(_yNft.expirationTimestamp >= now + 86400, "NFT is expired or within 1 day of expiry.");
        require(!_yNft.claimInProgress, "NFT has a claim in progress.");
        return true;
    }
    
    /**
     * @dev Check if an NFT is owned on here and has expired.
     * @param _yNft The token that is being checked for expiration.
    **/
    function _checkNftExpired(Token memory _yNft)
      internal
    returns (bool)
    {
        require(_yNft.expireTime <= block.number, "NFT is not expired.");
        return true;
    }
    
}