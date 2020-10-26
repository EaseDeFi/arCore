pragma solidity ^0.6.6;

import '../general/SafeMath.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IERC721.sol';
import '../interfaces/INexusMutual.sol';
import '../interfaces/IarNFT.sol';
import '../interfaces/IMedianizer.sol';
import './RewardManager.sol';
import './PlanManager.sol';
/**
 * @dev Encompasses all functions taken by stakers.
**/
contract StakeManager {
    
    using SafeMath for uint;
    
    /**
     * @notice  Don't even know if these are needed since the tokens are on separate contracts
     *          and we can just differentiate that way.
    **/
    bytes4 public constant ETH_SIG = bytes4(0x45544800);
    bytes4 public constant DAI_SIG = bytes4(0x44414900);
    
    // external contract addresses
    IarNFT public arNFT;
    IERC20 public daiContract;
    INXMMaster public nxmMaster;
    IMedianizer public medianizer;
   
    // internal contract addresses 
    RewardManager public rewardManager;
    PlanManager public planManager;
    // All NFTs will be immediately sent to the claim manager.
    address public claimManager;
    
    // The total amount of cover that is currently being staked.
    // mapping (keccak256(protocol, coverCurrencySig) => cover amount)
    mapping (bytes32 => uint256) public totalStakedAmount;
    
    // Mapping to keep track of which NFT is owned by whom.
    mapping (uint256 => address) nftOwners;
    
    // Price (in Ether per second) of an NFT. We must save this to retain eth => dai conversion from the staking.
    mapping (uint256 => uint256) nftPrices;
    
    // Event launched when an NFT is staked.
    event StakedNFT(address indexed user, bytes32 indexed protocol, uint256 nftId, uint256 sumAssured, uint16 coverPeriod, uint256 timestamp);
    
    // Event launched when an NFT expires.
    event ExpiredNFT(address indexed user, bytes32 indexed protocol, uint256 nftId, uint256 sumAssured, uint16 coverPeriod, uint256 timestamp);
    
    /**
     * @dev Construct the contract with the yNft contract.
     * @param _nftContract Address of the yNft contract.
    **/
    constructor(address _nxmMaster, address _nftContract, address _rewardManager, address _planManager, address _claimManager, address _medianizer)
      public
    {
        nxmMaster = INXMMaster(_nxmMaster);
        arNFT = IarNFT(_nftContract);
        rewardManager = RewardManager(_rewardManager);
        planManager = PlanManager(_planManager);
        claimManager = _claimManager;
        medianizer = IMedianizer(_medianizer);
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
        // Grab yNft struct from the ERC721 smart contract.
        // Must make this grab based on Eth/Dai contract.
        _checkNftExpired(_nftId);
        
        address user = nftOwners[_nftId];
        uint256 price = nftPrices[_nftId];
        require(user != address(0) && price > 0, "NFT does not belong here.");
        
        // determine cover price, convert to dai if needed
        rewardManager.updateStake(user);
        
        (/*coverId*/, /*status*/, uint256 sumAssured, uint16 coverPeriod, /*validUntil*/, address scAddress, 
         bytes4 coverCurrency, /*premiumNXM*/, /*coverPrice*/, /*claimId*/) = arNFT.getToken(_nftId);
        
        bytes32 protocol = _getProtocolBytes32(scAddress, coverCurrency);
        
        _subtractCovers(user, sumAssured, price, protocol);
        
        // Returns the caller some gas as well as ensure this function cannot be called again.
        delete nftOwners[_nftId];
        delete nftPrices[_nftId];
        
        emit ExpiredNFT(user, protocol, _nftId, sumAssured, coverPeriod, block.timestamp);
    }

    /**
     * @dev Check whether a new TOTAL cover is allowed.
     * @param _protocol Bytes32 keccak256(address protocol, bytes4 coverCurrency).
     * @param _totalBorrowedAmount The new total amount that would be being borrowed.
     * returns Whether or not this new total borrowed amount would be able to be covered.
    **/
    function allowedCover(bytes32 _protocol, uint256 _totalBorrowedAmount)
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
    function _stake(uint256 _nftId, address _user) //jkhkjh
      internal
    {
        // Reverts on failure.
        _checkNftValid(_nftId);
        
        (/*coverId*/, /*status*/, uint256 sumAssured, uint16 coverPeriod, /*validUntil*/, address scAddress, 
         bytes4 coverCurrency, /*premiumNXM*/, uint256 coverPrice, /*claimId*/) = arNFT.getToken(_nftId);
        
        // coverPrice must be determined by dividing by length.
        uint256 secondPrice = coverPrice / (uint256(coverPeriod) * 1 days);

        // Make sure price is in Ether per second.
        uint256 price = coverCurrency == ETH_SIG ? secondPrice : _convertDaiToEth(secondPrice);
        
        bytes32 protocol = _getProtocolBytes32(scAddress, coverCurrency);

        // Update PlanManager to use the correct price for the protocol.
        // Find price per amount here to update plan manager correctly.
        uint256 pricePerAmount = price / sumAssured;
        
        planManager.changePrice(protocol, pricePerAmount);
        
        arNFT.transferFrom(_user, claimManager, _nftId);

        // Save owner of NFT.
        nftOwners[_nftId] = _user;
        
        // Save current price (Ether per second) of NFT.
        nftPrices[_nftId] = price;

        _addCovers(_user, sumAssured, price, protocol);
        
        emit StakedNFT(_user, protocol, _nftId, sumAssured, coverPeriod, block.timestamp);
    }

    function _getProtocolBytes32(address _protocol, bytes4 coverCurrency) internal returns(bytes32) {
        return keccak256(abi.encodePacked(_protocol, coverCurrency));
    }

    function _getProtocolAddress(uint256 _coverId) internal returns(address) {
        address scAddress;
        ( , scAddress, , , ) = _getCoverDetails1(_coverId);
        return scAddress;
    }

    /**
     * @dev Converts Ether price and 
     */
    function _convertDaiToEth(uint256 _daiAmount)
      internal
    returns (uint256) 
    {
        (bytes32 daiPerEth, ) = medianizer.peek();
        return (_daiAmount * 10 ** 18) / uint256(daiPerEth);
    }
    
    /**
     * @dev Add to the cover amount for the user and contract overall.
     * @param _user The user who submitted.
     * @param _coverAmount The amount of cover being added.
     * @notice this must be changed for users to add cover price rather than amount
    **/
    function _addCovers(address _user, uint256 _coverAmount, uint256 _coverPrice, bytes32 _protocol)
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
    function _subtractCovers(address _user, uint256 _coverAmount, uint256 _coverPrice, bytes32 _protocol)
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
     * @param _coverId coverId (== tokenId) of nft
    **/
    function _checkNftValid(uint256 _coverId)
      internal
    {
        // do something with this
        uint256 expiresAt;
        require(expiresAt > now + 86400, "NFT is expired or within 1 day of expiry.");
        // do we need this?
        //require(!_yNft.claimInProgress, "NFT has a claim in progress.");
    }
    
    /**
     * @dev Check if an NFT is owned on here and has expired.
     * @param _coverId coverId (== tokenId) of nft
    **/
    function _checkNftExpired(uint256 _coverId)
      internal
    {
        uint256 expiresAt;
        require(expiresAt <= now, "NFT is not expired.");
    }
    
    function _getCoverDetails1(uint256 _coverId)
      internal
      view
      returns(
        address memberAddress,
        address scAddress,
        bytes4 currencyCode,
        uint256 sumAssured,
        uint256 premiumNXM
      ) {
        IQuotationData quotationData = IQuotationData(nxmMaster.getLatestAddress("QD"));
        ( , memberAddress, scAddress, currencyCode, sumAssured, premiumNXM) = quotationData.getCoverDetailsByCoverID1(_coverId);
    }
    
    /**
     *
    **/
    function _getCoverDetails2(uint256 _coverId)
      internal
      view
      returns(
        uint8 status,
        uint256 sumAssured,
        uint16 coverPeriod,
        uint256 validUntil
      )
    {
        IQuotationData quotationData = IQuotationData(nxmMaster.getLatestAddress("QD"));
        ( , status, sumAssured, coverPeriod, validUntil) = quotationData.getCoverDetailsByCoverID2(_coverId);
    }
}
