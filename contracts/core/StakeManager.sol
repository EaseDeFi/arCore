// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

import '../general/ExpireTracker.sol';
import '../general/ArmorModule.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IERC721.sol';
import '../interfaces/IarNFT.sol';
import '../interfaces/IRewardManager.sol';
import '../interfaces/IPlanManager.sol';
import '../interfaces/IClaimManager.sol';
import '../interfaces/IStakeManager.sol';

/**
 * @dev Encompasses all functions taken by stakers.
**/
contract StakeManager is ArmorModule, ExpireTracker, IStakeManager {
    
    using SafeMath for uint;
    
    bytes4 public constant ETH_SIG = bytes4(0x45544800);
    
    // Whether or not utilization farming is on.
    bool ufOn;
    
    // Amount of time--in seconds--a user must wait to withdraw an NFT.
    uint256 withdrawalDelay;
    
    // Protocols that staking is allowed for. We may not allow all NFTs.
    mapping (address => bool) public allowedProtocol;
    mapping (address => uint64) public override protocolId;
    mapping (uint64 => address) public override protocolAddress;
    uint64 protocolCount;
    
    // The total amount of cover that is currently being staked. scAddress => cover amount
    mapping (address => uint256) public override totalStakedAmount;
    
    // Mapping to keep track of which NFT is owned by whom. NFT ID => owner address.
    mapping (uint256 => address) public nftOwners;

    // When the NFT can be withdrawn. NFT ID => Unix timestamp.
    mapping (uint256 => uint256) public pendingWithdrawals;

    // Track if the NFT was submitted, in which case total staked has already been lowered.
    mapping (uint256 => bool) public submitted;

    // Event launched when an NFT is staked.
    event StakedNFT(address indexed user, address indexed protocol, uint256 nftId, uint256 sumAssured, uint256 secondPrice, uint16 coverPeriod, uint256 timestamp);

    // Event launched when an NFT expires.
    event RemovedNFT(address indexed user, address indexed protocol, uint256 nftId, uint256 sumAssured, uint256 secondPrice, uint16 coverPeriod, uint256 timestamp);

    event ExpiredNFT(address indexed user, uint256 nftId, uint256 timestamp);
    
    // Event launched when an NFT expires.
    event WithdrawRequest(address indexed user, uint256 nftId, uint256 timestamp, uint256 withdrawTimestamp);
    
    /**
     * @dev Construct the contract with the yNft contract.
    **/
    function initialize(address _armorMaster)
      public
      override
    {
        initializeModule(_armorMaster);
        // Let's be explicit. Testnet will have 0 to easily adjust stakers.
        withdrawalDelay = 0;
        ufOn = true;
    }

    /**
     * @dev Keep function can be called by anyone to remove any NFTs that have expired. Also run when calling many functions.
     *      This is external because the doKeep modifier calls back to ArmorMaster, which then calls back to here (and elsewhere).
    **/
    function keep() external {
        // Restrict each keep to 3 removals max.
        for (uint256 i = 0; i < 3; i++) {
            
            if (infos[head].expiresAt != 0 && infos[head].expiresAt <= now) _removeExpiredNft(head);
            else return;
            
        }
    }
    
    /**
     * @dev stakeNft allows a user to submit their NFT to the contract and begin getting returns.
     *      This yNft cannot be withdrawn!
     * @param _nftId The ID of the NFT being staked.
    **/
    function stakeNft(uint256 _nftId)
      public
      doKeep
    {
        _stake(_nftId, msg.sender);
    }

    /**
     * @dev stakeNft allows a user to submit their NFT to the contract and begin getting returns.
     * @param _nftIds The ID of the NFT being staked.
    **/
    function batchStakeNft(uint256[] memory _nftIds)
      public
      doKeep
    {
        // Loop through all submitted NFT IDs and stake them.
        for (uint256 i = 0; i < _nftIds.length; i++) {
            _stake(_nftIds[i], msg.sender);
        }
    }

    /**
     * @dev A user may call to withdraw their NFT. This may have a delay added to it.
     * @param _nftId ID of the NFT to withdraw.
    **/
    function withdrawNft(uint256 _nftId)
      external
      doKeep
    {
        require(nftOwners[_nftId] == msg.sender, "Sender does not own this NFT.");
        
        // Check when this NFT is allowed to be withdrawn. If 0, set it.
        uint256 withdrawalTime = pendingWithdrawals[_nftId];
        
        if (withdrawalTime == 0) {
            withdrawalTime = block.timestamp + withdrawalDelay;
            pendingWithdrawals[_nftId] = withdrawalTime;
            emit WithdrawRequest(msg.sender, _nftId, block.timestamp, withdrawalTime);
            return;
        } else if (withdrawalTime > block.timestamp) {
            return;
        }
        
        _removeNft(_nftId);
        IClaimManager(getModule("CLAIM")).transferNft(msg.sender, _nftId);
        delete pendingWithdrawals[_nftId];
    }

    /**
     * @dev Subtract from total staked. Used by ClaimManager in case NFT is submitted.
     * @param _protocol Address of the protocol to subtract from.
     * @param _subtractAmount Amount of staked to subtract.
    **/
    function subtractTotal(uint256 _nftId, address _protocol, uint256 _subtractAmount)
      external
      override
      onlyModule("CLAIM")
    {
        totalStakedAmount[_protocol] = totalStakedAmount[_protocol].sub(_subtractAmount);
        submitted[_nftId] = true;
    }

    /**
     * @dev Check whether a new TOTAL cover is allowed.
     * @param _protocol Address of the smart contract protocol being protected.
     * @param _totalBorrowedAmount The new total amount that would be being borrowed.
     * returns Whether or not this new total borrowed amount would be able to be covered.
    **/
    function allowedCover(address _protocol, uint256 _totalBorrowedAmount)
      external
      override
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
        (/*coverId*/,  uint8 coverStatus, uint256 sumAssured, uint16 coverPeriod, uint256 validUntil, address scAddress, 
         bytes4 coverCurrency, /*premiumNXM*/, uint256 coverPrice, /*claimId*/) = IarNFT(getModule("ARNFT")).getToken(_nftId);
        
        _checkNftValid(validUntil, scAddress, coverCurrency, coverStatus);
        
        // coverPrice must be determined by dividing by length.
        uint256 secondPrice = coverPrice / (uint256(coverPeriod) * 1 days);

        // Update PlanManager to use the correct price for the protocol.
        // Find price per amount here to update plan manager correctly.
        uint256 pricePerEth = secondPrice / sumAssured;
        
        IPlanManager(getModule("PLAN")).changePrice(scAddress, pricePerEth);
        
        IarNFT(getModule("ARNFT")).transferFrom(_user, getModule("CLAIM"), _nftId);

        ExpireTracker.push(uint96(_nftId), uint64(validUntil));
        // Save owner of NFT.
        nftOwners[_nftId] = _user;

        uint256 weiSumAssured = sumAssured * (10 ** 18);
        _addCovers(_user, weiSumAssured, secondPrice, scAddress);
        
        // Add to utilization farming.
        if (ufOn) IRewardManager(getModule("UFS")).stake(_user, secondPrice);
        
        emit StakedNFT(_user, scAddress, _nftId, weiSumAssured, secondPrice, coverPeriod, block.timestamp);
    }
    
    /**
     * @dev removeExpiredNft is called on many different interactions to the system overall.
     * @param _nftId The ID of the expired NFT.
    **/
    function _removeExpiredNft(uint256 _nftId)
      internal
    {
        address user = nftOwners[_nftId];
        _removeNft(_nftId);
        emit ExpiredNFT(user, _nftId, block.timestamp);
    }

    /**
     * @dev Internal main removal functionality.
    **/
    function _removeNft(uint256 _nftId)
      internal
    {
        (/*coverId*/, /*status*/, uint256 sumAssured, uint16 coverPeriod, /*uint256 validuntil*/, address scAddress, 
         /*coverCurrency*/, /*premiumNXM*/, uint256 coverPrice, /*claimId*/) = IarNFT(getModule("ARNFT")).getToken(_nftId);
        address user = nftOwners[_nftId];
        require(user != address(0), "NFT does not belong here.");

        ExpireTracker.pop(uint96(_nftId));

        uint256 weiSumAssured = sumAssured * (10 ** 18);
        uint256 secondPrice = coverPrice / (uint256(coverPeriod) * 1 days);
        _subtractCovers(user, _nftId, weiSumAssured, secondPrice, scAddress);
        
        // Exit from utilization farming.
        if (ufOn) IRewardManager(getModule("UFS")).withdraw(user, secondPrice);

        // Returns the caller some gas as well as ensure this function cannot be called again.
        delete nftOwners[_nftId];

        emit RemovedNFT(user, scAddress, _nftId, weiSumAssured, secondPrice, coverPeriod, block.timestamp);
    }
    
    /**
     * @dev Add to the cover amount for the user and contract overall.
     * @param _user The user who submitted.
     * @param _coverAmount The amount of cover being added.
     * @param _coverPrice Price paid by the user for the NFT per second.
     * @param _protocol Address of the protocol that is having cover added.
    **/
    function _addCovers(address _user, uint256 _coverAmount, uint256 _coverPrice, address _protocol)
      internal
    {
        IRewardManager(getModule("REWARD")).stake(_user, _coverPrice);
        totalStakedAmount[_protocol] = totalStakedAmount[_protocol].add(_coverAmount);
    }
    
    /**
     * @dev Subtract from the cover amount for the user and contract overall.
     * @param _user The user who is having the token removed.
     * @param _nftId ID of the NFT being used--must check if it has been submitted.
     * @param _coverAmount The amount of cover being removed.
     * @param _coverPrice Price that the user was paying per second.
     * @param _protocol The protocol that this NFT protected.
    **/
    function _subtractCovers(address _user, uint256 _nftId, uint256 _coverAmount, uint256 _coverPrice, address _protocol)
      internal
    {
        IRewardManager(getModule("REWARD")).withdraw(_user, _coverPrice);
        if (!submitted[_nftId]) totalStakedAmount[_protocol] = totalStakedAmount[_protocol].sub(_coverAmount);
    }
    
    /**
     * @dev Check that the NFT should be allowed to be added. We check expiry and claimInProgress.
     * @param _validUntil The expiration time of this NFT.
     * @param _scAddress The smart contract protocol that the NFt is protecting.
     * @param _coverCurrency The currency that this NFT is protected in (must be ETH_SIG).
     * @param _coverStatus status of cover, only accepts Active
    **/
    function _checkNftValid(uint256 _validUntil, address _scAddress, bytes4 _coverCurrency, uint8 _coverStatus)
      internal
      view
    {
        require(_validUntil > now + 86400, "NFT is expired or within 1 day of expiry.");
        // TODO: should change this to check status not claimId
        require(_coverStatus == 0, "arNFT claim is already in progress.");
        require(allowedProtocol[_scAddress], "Protocol is not allowed to be staked.");
        require(_coverCurrency == ETH_SIG, "Only Ether arNFTs may be staked.");
    }
    
    /**
     * @dev Allow the owner (DAO soon) to allow or disallow a protocol from being used in Armor.
     * @param _protocol The address of the protocol to allow or disallow.
     * @param _allow Whether to allow or disallow the protocol.
    **/
    function allowProtocol(address _protocol, bool _allow)
      external
      doKeep
      onlyOwner
    {
        if(protocolId[_protocol] == 0){
            protocolId[_protocol] = ++protocolCount;
            protocolAddress[protocolCount] = _protocol;
        }
        allowedProtocol[_protocol] = _allow;
    }
    
    /**
     * @dev Allow the owner to change the amount of delay to withdraw an NFT.
     * @param _withdrawalDelay The amount of time--in seconds--to delay an NFT withdrawal.
    **/
    function changeWithdrawalDelay(uint256 _withdrawalDelay)
      external
      doKeep
      onlyOwner
    {
        withdrawalDelay = _withdrawalDelay;
    }
    
    /**
     * @dev Toggle whether utilization farming should be on or off.
    **/
    function toggleUF()
      external
      onlyOwner
    {
        ufOn = !ufOn;
    }
}
