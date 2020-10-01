pragma solidity ^0.6.6;

import '../general/SafeMath.sol';
import '../interfaces/IToken.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IERC721.sol';
import '../RewardManager.sol';

/**
 * @dev Encompasses all functions taken by stakers.
**/
contract StakeManager is IToken {
    
    using SafeMath for uint;
    
    /**
     * @notice  Don't even know if these are needed since the tokens are on separate contracts
     *          and we can just differentiate that way.
    **/
    constant ETH_SIG = bytes4(0x45544800);
    constant DAI_SIG = bytes4(0x44414900);
    
    MakerDao public makerDao;
    /**
     * @notice  NFT contract actually needs to be multiple contracts I think? The yNFT tokens
     *          do not tell you which cover currency they are so we must judge by contract.
    **/
    IERC721 public nftContract;
    IERC20 public daiContract;
    RewardManager public rewardManager;
    
    // All NFTs will be immediately sent to the claim manager.
    address public claimManager;
    
    // The total amount of cover that is currently being staked.
    // mapping (keccak256(protocol, coverCurrencySig) => cover amount)
    mapping (bytes32 => uint256) public totalStakedCover;
    
    // Mapping to keep track of which NFT is owned by whom.
    mapping (uint256 => address) nftOwners;
    
    
    /**
     * @dev Construct the contract with the yNFT contract.
     * @param _nftContract Address of the yNFT contract.
    **/
    constructor(address _nftContract, address _rewardManager)
      public
    {
        nftContract = IERC721(_nftContract);
        rewardManager = RewardManager(_rewardManager);
    }
    
    /**
     * @dev stakeNft allows a user to submit their NFT to the contract and begin getting returns.
     *      This yNft cannot be withdrawn!
     * @param _nftId The ID of the NFT being staked.
    **/
    function stakeNft(uint256 _nftId, bytes4 _coverCurrency)
      public
    {
        // Find user then update their stake before adding a new NFT.
        address user = msg.sender;
        rewardManager.updateStake(user);
        
        _stake(_nftId, _coverCurrency, user);
    }

    /**
     * @dev stakeNft allows a user to submit their NFT to the contract and begin getting returns.
     * @param _nftIds The ID of the NFT being staked.
    **/
    function batchStakeNft(uint256[] calldata _nftIds, bytes4[] calldata _coverCurrencies)
      public
    {
        require(_nftIds.length == _coverCurrencies.length);
        
        // Find user then update their stake before adding a new NFT.
        address user = msg.sender;
        rewardManager.updateStake(user);

        // Loop through all submitted NFT IDs and stake them.
        for (uint256 i = 0; i < _nftIds.length; i++) {
            
            _stake(_nftIds[i], _coverCurrencies[i]user);
            
        }
    }

    /**
     * @dev removeExpiredNft is called on many different interactions to the system overall.
     * @param _nftId The ID of the expired NFT.
    **/
    function removeExpiredNft(uint256 _nftId)
      public
    {
        // Grab yNFT struct from the ERC21 smart contract.
        // Must make this grab based on Eth/Dai contract.
        Token memory yNft = nftContract.getToken(_nftId);
        
        address user = nftOwners[_nftId];
        require(_checkNftExpired(yNft, user), "NFT is not valid.");
        
        // determine cover price, convert to dai if needed
        
        /**
         * @notice All of these should be modifiers
        **/
        rewardManager.updateStake(user);
        _subtractCovers(user, yNft.coverAmount);
        
        // Returns the caller some gas as well as ensure this function cannot be called again.
        delete nftOwners[_nftId];
    }

    /**
     * @dev Check whether a new TOTAL cover is allowed.
     * @param _protocol Address of the protocol to be checked.
     * @param _coverCurrency ETH or DAI sig.
     * @param _totalCover The new total amount that would be being borrowed.
     * @returns Whether or not this new total borrowed amount would be able to be covered.
    **/
    function allowedCover(address _protocol, bytes4 _coverCurrency, uint256 _totalBorrowedCover)
      public
      view
    returns (bool)
    {
        bytes32 protocol = keccak256(_protocol, _coverCurrency);
        return _totalBorrowedCover <= totalStakedCover[protocol];
    }
    
    /**
     * @dev Internal function for staking--this allows us to skip updating stake multiple times during a batch stake.
     * @param _nftId The ID of the NFT being staked.
     * @param _user The user who is staking the NFT.
    **/
    function _stake(uint256 _nftId, address _user)
      internal
    {
        Token memory yNft = nftContract.getToken(_nftId);
        
        // cover price must be converted from eth to dai if eth
        uint256 daiPrice = makerDao.getDai();
        
        // cover price (Dai per second)
        
        // Reverts on failure.
        _checkNftValid(yNft);
        
        require(nftContract.transferFrom(_user, claimManager, _nftId), "NFT transfer was unsuccessful.");

        nftOwners[_nftId] = _user;
        _addCovers(_user, yNft.coverAmount, daiCoverPrice);
    }
    
    /**
     * @dev Converts Ether price and 
    function _convertEth(uint256 _ethAmount)
      internal
    return (uint256)
    **/
    
    /**
     * @dev Find price per DAI per second of latest NFT submitted.
    **/
    function findPrice(uint256 _coverPrice, uint256 _coverAmount, uint256 _genTime, uint256 _expireTime)
      internal
      pure
    returns (uint256 price)
    {
        // Let's switch this out for SafeMath. (lol at below var)
        uint256 noWeiDai = _coverAmount.div(1e18);
        uint256 secsLength = _expireTime - _genTime;
        
        // 1,000 dai price to cover 10,000 dai for 1 month:
        // 1000 * 1e18 / 10000 / 2592000 = 3.8580247e+15 DAI/second == $33.33... per day
        price = _coverPrice / noWeiDai / secsLength;
    }
    
    /**
     * @dev Add to the cover amount for the user and contract overall.
     * @param _user The user who submitted.
     * @param _coverAmount The amount of cover being added.
     * @notice this must be changed for users to add cover price rather than amount
    **/
    function _addCovers(address _user, uint256 _coverAmount, uint256 _coverPrice)
      internal
    {
        /**
         * @notice This needs to point to user cover on RewardManager.
        **/
        userCover[_user] = userCover[_user].add(_coverPrice);
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
        /**
         * @notice This needs to point to user cover on RewardManager.
        **/
        userCover[_user] = userCover[_user].sub(_coverAmount);
        totalStakedCover = totalStakedCover.sub(_coverAmount);
    }
    
    /**
     * @dev Check that the NFT should be allowed to be added. We check expiry and claimInProgress.
     * @param _yNft The full NFT being dealt with.
    **/
    function _checkNftValid(Token memory _yNft)
      internal
    {
        require(_yNft.expirationTimestamp >= now + 86400, "NFT is expired or within 1 day of expiry.");
        require(!_yNft.claimInProgress, "NFT has a claim in progress.");
    }
    
    /**
     * @dev Check if an NFT is owned on here and has expired.
     * @param _yNft The token that is being checked for expiration.
    **/
    function _checkNftExpired(Token memory _yNft, address _user)
      internal
    {
        require(_yNft.expirationTimestamp <= now, "NFT is not expired.");
        require(_user != address(0), "NFT does not exist on this contract.")
    }
    
}