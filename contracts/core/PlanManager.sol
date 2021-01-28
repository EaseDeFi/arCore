// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

import '../general/ArmorModule.sol';
import '../libraries/SafeMath.sol';
import '../libraries/MerkleProof.sol';
import '../interfaces/IStakeManager.sol';
import '../interfaces/IBalanceManager.sol';
import '../interfaces/IPlanManager.sol';
import '../interfaces/IClaimManager.sol';

/**
 * @dev Separating this off to specifically doKeep track of a borrower's plans.
**/
contract PlanManager is ArmorModule, IPlanManager {
    
    using SafeMath for uint;
    
    uint256 constant private DENOMINATOR = 1000;
    
    // List of plans that a user has purchased so there is a historical record.
    mapping (address => Plan[]) public plans;

    // keccak256("ARMORFI.PLAN", address(user), uint256(planIdx), uint256(protocolIdx)) => ProtocolPlan
    mapping (bytes32 => ProtocolPlan) public protocolPlan;
    
    // StakeManager calls this when a new NFT is added to update what the price for that protocol is.
    // Cover price in ETH (1e18) of price per second per DAI covered.
    mapping (address => uint256) public nftCoverPrice;
    
    // Mapping to doKeep track of how much coverage we've sold for each protocol.
    // smart contract address => total borrowed cover
    mapping (address => uint256) public totalUsedCover;
    
    // Protocol => amount of coverage bought by shields (then shields plus) for that protocol.
    // Keep track of these to only allow a % of staked NFTs to be bought by each.
    mapping (address => uint256) public arShieldCover;
    mapping (address => uint256) public arShieldPlusCover;
    mapping (address => uint256) public coreCover;
    
    // Percent allocated to each part of the system. 350 == 35%.
    uint256 public arShieldPercent;
    uint256 public arShieldPlusPercent;
    uint256 public corePercent;
    
    // Mapping of the address of shields => 1 if they're arShield and 2 if they're arShieldPlus.
    mapping (address => uint256) public arShields;
    
    // The amount of markup for Armor's service vs. the original cover cost. 200 == 200%.
    uint256 public markup;

    // Mapping = protocol => cover amount
    struct Plan {
        uint64 startTime;
        uint64 endTime;
        uint128 length;
    }

    struct ProtocolPlan {
        uint64 protocolId;
        uint192 amount;
    }
    
    function initialize(
        address _armorMaster
    ) external override {
        initializeModule(_armorMaster);
        markup = 150;
        arShieldPercent = 350;
        arShieldPlusPercent = 350;
        corePercent = 300;
    }
    
    function getCurrentPlan(address _user) external view override returns(uint128 start, uint128 end){
        if(plans[_user].length == 0){
            return(0,0);
        }
        Plan memory plan = plans[_user][plans[_user].length-1];
        
        //return 0 if there is no active plan
        if(plan.endTime < now){
            return(0,0);
        } else {
            start = plan.startTime;
            end = plan.endTime;
        }
    }
    
    /*
     * @dev User can update their plan for cover amount on any protocol.
     * @param _protocols Addresses of the protocols that we want coverage for.
     * @param _coverAmounts The amount of coverage desired in WEI.
     * @notice Let's simplify this somehow--even just splitting into different functions.
    **/
    function updatePlan(address[] calldata _protocols, uint256[] calldata _coverAmounts)
      external
      doKeep
      override
    {
        require(_protocols.length == _coverAmounts.length, "protocol and coverAmount length mismatch");
        // Need to get price of the protocol here
        if(plans[msg.sender].length > 0){
          Plan storage lastPlan = plans[msg.sender][plans[msg.sender].length - 1];

          // First go through and subtract all old cover amounts.
          _removeLatestTotals(msg.sender);
          
          // Set current plan to have ended now or when it ended previously.
          lastPlan.endTime = lastPlan.endTime <= now ? lastPlan.endTime : uint64(now);
        }

        _addNewTotals(_protocols, _coverAmounts);
        uint256 newPricePerSec;
        uint256 _markup = markup;
        
        
        // Loop through protocols, find price per second, add to rate, add coverage amount to mapping.
        for (uint256 i = 0; i < _protocols.length; i++) {
            require(nftCoverPrice[_protocols[i]] != 0, "Protocol price is zero");
            
            // nftCoverPrice is per full Ether, so a cover amont in Wei must be divided by 18 decimals after.
            uint256 pricePerSec = nftCoverPrice[ _protocols[i] ].mul(_coverAmounts[i]);
            newPricePerSec = newPricePerSec.add(pricePerSec);
        }
        
        //newPricePerSec = newPricePerSec * _markup / 1e18 for decimals / 100 to make up for markup (200 == 200%);
        newPricePerSec = newPricePerSec.mul(_markup).div(1e18).div(100);
        
        // this means user is canceling all plans
        if(newPricePerSec == 0){
            Plan memory newPlan;
            newPlan = Plan(uint64(now), uint64(-1), uint128(0));
            plans[msg.sender].push(newPlan);
            IBalanceManager(getModule("BALANCE")).changePrice(msg.sender, 0);
            emit PlanUpdate(msg.sender, _protocols, _coverAmounts, uint64(-1));
            return;
        }

        uint256 balance = IBalanceManager(getModule("BALANCE")).balanceOf(msg.sender);
        uint256 endTime = balance.div(newPricePerSec).add(block.timestamp);
        
        // Let's make sure a user can pay for this for at least a week. Weird manipulation of utilization farming could happen otherwise.
        require(endTime >= block.timestamp.add(7 days), "Balance must be enough for 7 days of coverage.");
        
        //add plan
        Plan memory newPlan;
        newPlan = Plan(uint64(now), uint64(endTime), uint128(_protocols.length));
        plans[msg.sender].push(newPlan);
        
        //add protocol plan
        for(uint256 i = 0;i<_protocols.length; i++){
            bytes32 key = keccak256(abi.encodePacked("ARMORFI.PLAN.",msg.sender,plans[msg.sender].length - 1,i));
            uint64 protocolId = IStakeManager(getModule("STAKE")).protocolId(_protocols[i]);
            protocolPlan[key] = ProtocolPlan(protocolId, uint192(_coverAmounts[i]));
        }
        
        // update balance price per second here
        uint64 castPricePerSec = uint64(newPricePerSec);
        require(uint256(castPricePerSec) == newPricePerSec);
        IBalanceManager(getModule("BALANCE")).changePrice(msg.sender, castPricePerSec);

        emit PlanUpdate(msg.sender, _protocols, _coverAmounts, endTime);
    }

    /**
     * @dev Update the contract-wide totals for each protocol that has changed.
     * @param _user User whose plan is updating these totals.
    **/
    function _removeLatestTotals(address _user) internal{
        Plan storage plan = plans[_user][plans[_user].length - 1];

        uint256 idx = plans[_user].length - 1;

        for (uint256 i = 0; i < plan.length; i++) {
            bytes32 key = keccak256(abi.encodePacked("ARMORFI.PLAN.",_user,idx,i));
            ProtocolPlan memory protocol = protocolPlan[key];
            address protocolAddress = IStakeManager(getModule("STAKE")).protocolAddress(protocol.protocolId);
            totalUsedCover[protocolAddress] = totalUsedCover[protocolAddress].sub(uint256(protocol.amount));
            
            uint256 shield = arShields[_user];
            if (shield == 1) {
                arShieldCover[protocolAddress] = arShieldCover[protocolAddress].sub(protocol.amount);
            } else if (shield == 2) {
                arShieldPlusCover[protocolAddress] = arShieldPlusCover[protocolAddress].sub(protocol.amount);
            } else {
                coreCover[protocolAddress] = coreCover[protocolAddress].sub(protocol.amount);
            }   
        }
    }

    /**
     * @dev Add new totals for new protocol/cover amounts.
     * @param _newProtocols Protocols that are being borrowed for.
     * @param _newCoverAmounts Cover amounts (in Wei) that are being borrowed.
    **/
    function _addNewTotals(address[] memory _newProtocols, uint256[] memory _newCoverAmounts) internal {
        for (uint256 i = 0; i < _newProtocols.length; i++) {
            
            (uint256 shield, uint256 allowed) = _checkBuyerAllowed(_newProtocols[i]);
            require(allowed >= _newCoverAmounts[i], "Exceeds allowed cover amount.");
            
            totalUsedCover[_newProtocols[i]] = totalUsedCover[_newProtocols[i]].add(_newCoverAmounts[i]);
            
            if (shield == 1) {
                arShieldCover[_newProtocols[i]] = arShieldCover[_newProtocols[i]].add(_newCoverAmounts[i]);
            } else if (shield == 2) {
                arShieldPlusCover[_newProtocols[i]] = arShieldPlusCover[_newProtocols[i]].add(_newCoverAmounts[i]);
            } else {
                coreCover[_newProtocols[i]] = coreCover[_newProtocols[i]].add(_newCoverAmounts[i]);
            }
        }
    }

    /**
     * @dev Determine the amount of coverage left for a specific protocol.
     * @param _protocol The address of the protocol we're determining coverage left for.
    **/
    function coverageLeft(address _protocol)
      external
      override
      view
    returns (uint256) {
        (/* uint256 shield */, uint256 allowed) = _checkBuyerAllowed(_protocol);
        return allowed;
    }
    
    /**
     * @dev Check whether the buyer is allowed to purchase this amount of cover.
     *      Used because core can only buy 30%, and 35% for shields.
     * @param _protocol The protocol cover is being purchased for.
    **/
    function _checkBuyerAllowed(address _protocol)
      internal
      view
    returns (uint256, uint256)
    {
        uint256 totalAllowed = IStakeManager(getModule("STAKE")).totalStakedAmount(_protocol);
        uint256 shield = arShields[msg.sender];
            
        if (shield == 1) {
            uint256 currentCover = arShieldCover[_protocol];
            uint256 allowed = totalAllowed * arShieldPercent / DENOMINATOR;
            return (shield, allowed > currentCover ? allowed - currentCover : 0);
        } else if (shield == 2) {
            uint256 currentCover = arShieldPlusCover[_protocol];
            uint256 allowed = totalAllowed * arShieldPlusPercent / DENOMINATOR;
            return (shield, allowed > currentCover ? allowed - currentCover : 0);
        } else {
            uint256 currentCover = coreCover[_protocol];
            uint256 allowed = totalAllowed * corePercent / DENOMINATOR;
            return (shield, allowed > currentCover ? allowed - currentCover : 0);        
        }
    }
    
    /**
     * @dev Used by ClaimManager to check how much coverage the user had at the time of a hack.
     * @param _user The user to check coverage for.
     * @param _protocol The address of the protocol that was hacked. (Address used according to arNFT).
     * @param _hackTime The timestamp of when a hack happened.
     * @return index index of plan for hackTime
     * @return check 
    **/
    function checkCoverage(address _user, address _protocol, uint256 _hackTime, uint256 _amount)
      external
      view
      override
      returns(uint256 index, bool check)
    {
        // This may be more gas efficient if we don't grab this first but instead grab each plan from storage individually?
        Plan[] storage planArray = plans[_user];
        
        // In normal operation, this for loop should never get too big.
        // If it does (from malicious action), the user will be the only one to suffer.
        for (int256 i = int256(planArray.length - 1); i >= 0; i--) {
            Plan storage plan = planArray[uint256(i)];
            // Only one plan will be active at the time of a hack--return cover amount from then.
            if (_hackTime >= plan.startTime && _hackTime < plan.endTime) {
                for(uint256 j = 0; j< plan.length; j++){
                    bytes32 key = keccak256(abi.encodePacked("ARMORFI.PLAN.",_user,i,j));
                    if(IStakeManager(getModule("STAKE")).protocolAddress(protocolPlan[key].protocolId) == _protocol){
                        return (uint256(i), _amount <= uint256(protocolPlan[key].amount));
                    }
                }
                return (uint256(i), false);
            }
        }
        return (uint256(-1), false);
    }

    /**
     * @dev ClaimManager redeems the plan if it has been claimed. Sets claim amount to 0 so it cannot be claimed again.
     * @param _user User that is redeeming this plan.
     * @param _planIndex The index in the user's Plan array that we're checking.
     * @param _protocol Address of the protocol that a claim is being redeemed for.
    **/
    function planRedeemed(address _user, uint256 _planIndex, address _protocol) 
      external 
      override 
      onlyModule("CLAIM")
    {
        Plan storage plan = plans[_user][_planIndex];
        require(plan.endTime <= now, "Cannot redeem active plan, update plan to redeem properly");

        for (uint256 i = 0; i < plan.length; i++) {
            bytes32 key = keccak256(abi.encodePacked("ARMORFI.PLAN.",_user,_planIndex,i));
            
            ProtocolPlan memory protocol = protocolPlan[key];
            address protocolAddress = IStakeManager(getModule("STAKE")).protocolAddress(protocol.protocolId);
            
            if (protocolAddress == _protocol) protocolPlan[key].amount = 0;
        }
    }

    /**
     * @dev Armor has the ability to change the price that a user is paying for their insurance.
     * @param _protocol The protocol whose arNFT price is being updated.
     * @param _newPrice the new price PER BLOCK that the user will be paying.
    **/
    function changePrice(address _protocol, uint256 _newPrice)
      external
      override
      onlyModule("STAKE")
    {
        nftCoverPrice[_protocol] = _newPrice;
    }

    /**
     * @dev BalanceManager calls to update expire time of a plan when a deposit/withdrawal happens.
     * @param _user Address whose balance was updated.
    **/
    function updateExpireTime(address _user)
      external
      override
      onlyModule("BALANCE")
    {
        if (plans[_user].length == 0) return;
        Plan storage plan = plans[_user][plans[_user].length-1];
        uint256 balance = IBalanceManager(getModule("BALANCE")).balanceOf(_user);
        uint256 pricePerSec = IBalanceManager(getModule("BALANCE")).perSecondPrice(_user);
        
        if (plan.endTime > block.timestamp) {
            plan.endTime = uint64(balance.div(pricePerSec).add(block.timestamp));
        }
    }
    
    /**
     * @dev Owner (DAO) can adjust the markup buyers pay for coverage.
     * @param _newMarkup The new markup that will be used. 100 == 100% (no markup).
    **/
    function adjustMarkup(uint256 _newMarkup)
      external
      onlyOwner
    {
        require(_newMarkup >= 100, "Markup must be at least 0 (100%).");
        markup = _newMarkup;
    }
    
    /**
     * @dev Owner (DAO) can adjust the percent of coverage allowed for each product.
     * @param _newCorePercent New percent of coverage for general arCore users.
     * @param _newArShieldPercent New percent of coverage for arShields.
     * @param _newArShieldPlusPercent New percent of coverage for arShield Plus.
    **/
    function adjustPercents(uint256 _newCorePercent, uint256 _newArShieldPercent, uint256 _newArShieldPlusPercent)
      external
      onlyOwner
    {
        require(_newCorePercent + _newArShieldPercent + _newArShieldPlusPercent == 1000, "Total allocation cannot be more than 100%.");
        corePercent = _newCorePercent;
        arShieldPercent = _newArShieldPercent;
        arShieldPlusPercent = _newArShieldPlusPercent;
    }
    
    /**
     * @dev Owner (DAO) can adjust shields on the contract.
     * @param _shieldAddress Array of addresses we're adjusting.
     * @param _shieldType Type of shield: 1 for arShield, 2 for arShield Plus.
    **/
    function adjustShields(address[] calldata _shieldAddress, uint256[] calldata _shieldType)
      external
      onlyOwner
    {
        require(_shieldAddress.length == _shieldType.length, "Submitted arrays are not of equal length.");
        for (uint256 i = 0; i < _shieldAddress.length; i++) {
            arShields[_shieldAddress[i]] = _shieldType[i];
        }
    }
    
}
