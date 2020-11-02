pragma solidity ^0.6.6;

import '../general/SafeMath.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IERC721.sol';
import '../interfaces/IarNFT.sol';
import '../interfaces/IRewardManager.sol';
import '../interfaces/IPlanManager.sol';
import '../general/Ownable.sol';

/**
 * @dev Encompasses all functions taken by stakers.
**/
contract StakeManager is Ownable {
    
    using SafeMath for uint;
    
    /**
     * @notice  Don't even know if these are needed since the tokens are on separate contracts
     *          and we can just differentiate that way.
    **/
    bytes4 public constant ETH_SIG = bytes4(0x45544800);

    // external contract addresses
    IarNFT public arNFT;
    IERC20 public daiContract;

    // internal contract addresses 
    IRewardManager public rewardManager;
    IPlanManager public planManager;
    // All NFTs will be immediately sent to the claim manager.
    address public claimManager;
    
    // Protocols that staking is allowed for. We may not allow all NFTs.
    mapping (address => bool) public allowedProtocols;
    
    // The total amount of cover that is currently being staked.
    // mapping (scAddress => cover amount)
    mapping (address => uint256) public totalStakedAmount;
    
    // Mapping to keep track of which NFT is owned by whom.
    mapping (uint256 => address) nftOwners;
    
    // Price (in Ether per second) of an NFT. We must save this to retain eth => dai conversion from the staking.
    mapping (uint256 => uint256) nftPrices;
    
    // Event launched when an NFT is staked.
    event StakedNFT(address indexed user, address indexed protocol, uint256 nftId, uint256 sumAssured, uint256 secondPrice, uint16 coverPeriod, uint256 timestamp);
    
    // Event launched when an NFT expires.
    event ExpiredNFT(address indexed user, address indexed protocol, uint256 nftId, uint256 sumAssured, uint256 secondPrice, uint16 coverPeriod, uint256 timestamp);
    
    /**
     * @dev Construct the contract with the yNft contract.
     * @param _nftContract Address of the yNft contract.
    **/
    function initialize(address _nftContract, address _rewardManager, address _planManager, address _claimManager)
      public
    {
        Ownable.initialize();
        require(arNFT == IarNFT( address(0) ), "Contract already initialized.");
        arNFT = IarNFT(_nftContract);
        rewardManager = IRewardManager(_rewardManager);
        planManager = IPlanManager(_planManager);
        claimManager = _claimManager;
    }
    
    modifier updateStake(address _user)
    {
        rewardManager.updateStake(_user);
        _;
    }
    
    /**
     * @dev stakeNft allows a user to submit their NFT to the contract and begin getting returns.
     *      This yNft cannot be withdrawn!
     * @param _nftId The ID of the NFT being staked.
    **/
    function stakeNft(uint256 _nftId)
      public
      updateStake(msg.sender)
    {
        _stake(_nftId, msg.sender);
    }

    /**
     * @dev stakeNft allows a user to submit their NFT to the contract and begin getting returns.
     * @param _nftIds The ID of the NFT being staked.
    **/
    function batchStakeNft(uint256[] memory _nftIds)
      public
      updateStake(msg.sender)
    {
        // Loop through all submitted NFT IDs and stake them.
        for (uint256 i = 0; i < _nftIds.length; i++) {
            _stake(_nftIds[i], msg.sender);
        }
    }

    /**
     * @dev removeExpiredNft is called on many different interactions to the system overall.
     * @param _nftId The ID of the expired NFT.
    **/
    function removeExpiredNft(uint256 _nftId)
      public
    {
        (/*coverId*/, /*status*/, uint256 sumAssured, uint16 coverPeriod, uint256 validUntil, address scAddress, 
         /*coverCurrency*/, /*premiumNXM*/, uint256 coverPrice, /*claimId*/) = arNFT.getToken(_nftId);
        
        _checkNftExpired(validUntil);
        
        address user = nftOwners[_nftId];
        require(user != address(0), "NFT does not belong here.");
        
        // determine cover price, convert to dai if needed
        rewardManager.updateStake(user);
        
        uint256 secondPrice = coverPrice / (uint256(coverPeriod) * 1 days);
        
        _subtractCovers(user, sumAssured, secondPrice, scAddress);
        
        // Returns the caller some gas as well as ensure this function cannot be called again.
        delete nftOwners[_nftId];
        
        emit ExpiredNFT(user, scAddress, _nftId, sumAssured, secondPrice, coverPeriod, block.timestamp);
    }

    /**
     * @dev Check whether a new TOTAL cover is allowed.
     * @param _protocol Address of the smart contract protocol being protected.
     * @param _totalBorrowedAmount The new total amount that would be being borrowed.
     * returns Whether or not this new total borrowed amount would be able to be covered.
    **/
    function allowedCover(address _protocol, uint256 _totalBorrowedAmount)
      public
      view
    returns (bool)
    {
        return _totalBorrowedAmount <= totalStakedAmount[_protocol];
    }
    
    /**
     * @dev Internal function for staking--this allows us to skip updating stake multiple times during a batch stake.
     * @param _nftId The ID of the NFT being staked. == coverId
     * @param _user The user who is staking the NFT.
    **/
    function _stake(uint256 _nftId, address _user)
      internal
    {
        (/*coverId*/, /*status*/, uint256 sumAssured, uint16 coverPeriod, uint256 validUntil, address scAddress, 
         bytes4 coverCurrency, /*premiumNXM*/, uint256 coverPrice, uint256 claimId) = arNFT.getToken(_nftId);
        
        _checkNftValid(validUntil, scAddress, coverCurrency, claimId);
        
        // coverPrice must be determined by dividing by length.
        uint256 secondPrice = coverPrice / (uint256(coverPeriod) * 1 days);

        // Update PlanManager to use the correct price for the protocol.
        // Find price per amount here to update plan manager correctly.
        uint256 pricePerAmount = secondPrice / sumAssured;
        
        planManager.changePrice(scAddress, pricePerAmount);
        
        arNFT.transferFrom(_user, claimManager, _nftId);

        // Save owner of NFT.
        nftOwners[_nftId] = _user;

        _addCovers(_user, sumAssured, secondPrice, scAddress);
        
        emit StakedNFT(_user, scAddress, _nftId, sumAssured, secondPrice, coverPeriod, block.timestamp);
    }
    
    /**
     * @dev Add to the cover amount for the user and contract overall.
     * @param _user The user who submitted.
     * @param _coverAmount The amount of cover being added.
     * @notice this must be changed for users to add cover price rather than amount
    **/
    function _addCovers(address _user, uint256 _coverAmount, uint256 _coverPrice, address _protocol)
      internal
    {
        /**
         * @notice This needs to point to user cover on RewardManager.
        **/
        rewardManager.addStakes(_user, _coverPrice);
        totalStakedAmount[_protocol] = totalStakedAmount[_protocol].add(_coverAmount);
    }
    
    /**
     * @dev Subtract from the cover amount for the user and contract overall.
     * @param _user The user who is having the token removed.
     * @param _coverAmount The amount of cover being removed.
    **/
    function _subtractCovers(address _user, uint256 _coverAmount, uint256 _coverPrice, address _protocol)
      internal
    {
        /**
         * @notice This needs to point to user cover on RewardManager.
        **/
        rewardManager.subStakes(_user, _coverPrice);
        totalStakedAmount[_protocol] = totalStakedAmount[_protocol].sub(_coverAmount);
    }
    
    /**
     * @dev Check that the NFT should be allowed to be added. We check expiry and claimInProgress.
     * @param _validUntil The expiration time of this NFT.
     * @param _scAddress The smart contract protocol that the NFt is protecting.
     * @param _coverCurrency The currency that this NFT is protected in (must be ETH_SIG).
     * @param _claimId ID of the claim (if any) that this NFT is going through.
    **/
    function _checkNftValid(uint256 _validUntil, address _scAddress, bytes4 _coverCurrency, uint256 _claimId)
      internal
      view
    {
        require(_validUntil > now + 86400, "NFT is expired or within 1 day of expiry.");
        require(_claimId == 0, "arNFT claim is already in progress.");
        require(allowedProtocols[_scAddress], "Protocol is not allowed to be staked.");
        require(_coverCurrency == ETH_SIG, "Only Ether arNFTs may be staked.");
    }
    
    /**
     * @dev Check if an NFT is owned on here and has expired.
     * @param _validUntil Unix time that the NFT expires.
    **/
    function _checkNftExpired(uint256 _validUntil)
      internal
      view
    {
        require(_validUntil < now, "NFT is not expired.");
    }
    
    /**
     * @dev Allow the owner (DAO soon) to allow or disallow a protocol from being used in Armor.
     * @param _protocol The address of the protocol to allow or disallow.
     * @param _allow Whether to allow or disallow the protocol.
    **/
    function allowProtocol(address _protocol, bool _allow)
      external
      onlyOwner
    {
        allowedProtocols[_protocol] = _allow;    
    }
    
}
