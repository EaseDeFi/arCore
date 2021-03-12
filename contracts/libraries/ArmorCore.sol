// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "../libraries/SafeMath.sol";
import "../interfaces/IArmorMaster.sol";
import "../interfaces/IBalanceManager.sol";
import "../interfaces/IPlanManager.sol";
import "../interfaces/IClaimManager.sol";
import "../interfaces/IStakeManager.sol";

/**
 * @dev ArmorCore library simplifies integration of Armor Core into other contracts. It contains most functionality needed for a contract to use arCore.
**/
library ArmorCore {

    using SafeMath for uint256;

    IArmorMaster internal constant armorMaster = IArmorMaster(0x1337DEF1900cEaabf5361C3df6aF653D814c6348);

    struct Plan {
        uint64 startTime;
        uint64 endTime;
        uint128 length;
    }

    struct ProtocolPlan {
        uint64 protocolId;
        uint192 amount;
    }

    /**
     * @dev Get Armor module such as BalanceManager, PlanManager, etc.
     * @param _name Name of the module (such as "BALANCE").
    **/
    function getModule(bytes32 _name) internal view returns(address) {
        return armorMaster.getModule(_name);
    }

    /**
     * @dev Calculate the price per second for a specific amount of Ether.
     * @param _protocol Address of protocol to protect.
     * @param _coverAmount Amount of Ether to cover (in Wei). We div by 1e18 at the end because both _coverAmount and pricePerETH return are 1e18.
     * @return pricePerSec Ether (in Wei) price per second of this coverage.
    **/
    function calculatePricePerSec(address _protocol, uint256 _coverAmount) internal view returns (uint256 pricePerSec) {
        return pricePerETH(_protocol).mul(_coverAmount).div(1e18);
    }

    /**
     * @dev Calculate price per second for an array of protocols and amounts.
     * @param _protocols Protocols to protect.
     * @param _coverAmounts Amounts (in Wei) of Ether to protect.
     * @return pricePerSec Ether (in Wei) price per second of this coverage,
    **/
    function calculatePricePerSec(address[] memory _protocols, uint256[] memory _coverAmounts) internal view returns (uint256 pricePerSec) {
        require(_protocols.length == _coverAmounts.length, "Armor: array length diff");
        for(uint256 i = 0; i<_protocols.length; i++){
            pricePerSec = pricePerSec.add(pricePerETH(_protocols[i]).mul(_coverAmounts[i]));
        }
        return pricePerSec.div(1e18);
    }

    /**
     * @dev Find amount of cover available for the specified protocol (up to amount desired).
     * @param _protocol Protocol to check cover for.
     * @param _amount Max amount of cover you would like.
     * @return available Amount of cover that is available (in Wei) up to full amount desired.
    **/
    function availableCover(address _protocol, uint256 _amount) internal view returns (uint256 available) {
        IStakeManager stakeManager = IStakeManager(getModule("STAKE"));
        uint64 protocolId = stakeManager.protocolId(_protocol);
        
        IPlanManager planManager = IPlanManager(getModule("PLAN"));
        Plan[] memory plans = planManager.plans( address(this) );
        Plan memory plan = plans[plans.length - 1];
        uint256 length = uint256( plan.length );
        
        uint256 currentCover = 0;
        for (uint256 i = 0; i < length; i++) {
            ProtocolPlan memory protocolPlan = planManager.protocolPlan( _hashKey(address(this), plans.length - 1, i) );
            if (protocolPlan.protocolId == protocolId) currentCover = uint256( protocolPlan.amount );
        }
        
        uint256 extraCover = planManager.coverageLeft(_protocol);
        
        // Add current coverage because coverageLeft on planManager does not include what we're currently using.
        return extraCover.add(currentCover) >= _amount ? _amount : extraCover.add(currentCover);
    }

    /**
     * @dev Find the price per second per Ether for the protocol.
     * @param _protocol Protocol we are finding the price for.
     * @return pricePerSecPerETH The price per second per each full Eth for the protocol.
    **/
    function pricePerETH(address _protocol) internal view returns(uint256 pricePerSecPerETH) {
        IPlanManager planManager = IPlanManager(getModule("PLAN"));
        pricePerSecPerETH = planManager.nftCoverPrice(_protocol).mul(planManager.markup()).div(100);
    }

    /**
     * @dev Subscribe to or update an Armor plan.
     * @param _protocols Protocols to be covered for.
     * @param _coverAmounts Ether amounts (in Wei) to purchase cover for. 
    **/
    function subscribe(address[] memory _protocols, uint256[] memory _coverAmounts) internal {
        IPlanManager planManager = IPlanManager(getModule("PLAN"));
        planManager.updatePlan(_protocols, _coverAmounts);
    }

    /**
     * @dev Subscribe to or update an Armor plan.
     * @param _protocol Protocols to be covered for.
     * @param _coverAmount Ether amounts (in Wei) to purchase cover for. 
    **/
    function subscribe(address _protocol, uint256 _coverAmount) internal {
        IPlanManager planManager = IPlanManager(getModule("PLAN"));
        address[] memory protocols = new address[](1);
        protocols[0] = _protocol;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _coverAmount;
        planManager.updatePlan(protocols, amounts);
    }

    function balanceOf() internal view returns (uint256) {
        IBalanceManager balanceManager = IBalanceManager(getModule("BALANCE"));
        return balanceManager.balanceOf( address(this) );
    }

    /**
     * @dev Deposit funds into the BalanceManager contract.
     * @param amount Amount of Ether (in Wei) to deposit into the contract.
    **/
    function deposit(uint256 amount) internal {
        IBalanceManager balanceManager = IBalanceManager(getModule("BALANCE"));
        balanceManager.deposit{value:amount}(address(0));
    }

    /**
     * @dev Withdraw balance from the BalanceManager contract.
     * @param amount Amount (in Wei) if Ether to withdraw from the contract.
    **/
    function withdraw(uint256 amount) internal {
        IBalanceManager balanceManager = IBalanceManager(getModule("BALANCE"));
        balanceManager.withdraw(amount);
    }

    /**
     * @dev Claim funds after a hack has occurred on a protected protocol.
     * @param _protocol The protocol that was hacked.
     * @param _hackTime The Unix timestamp at which the hack occurred. Determined by Armor DAO.
     * @param _amount Amount of funds to claim (in Ether Wei).
    **/
    function claim(address _protocol, uint256 _hackTime, uint256 _amount) internal {
        IClaimManager claimManager = IClaimManager(getModule("CLAIM"));
        claimManager.redeemClaim(_protocol, _hackTime, _amount);
    }

    /**
     * @dev End Armor coverage. 
    **/
    function cancelPlan() internal {
        IPlanManager planManager = IPlanManager(getModule("PLAN"));
        address[] memory emptyProtocols = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);
        planManager.updatePlan(emptyProtocols, emptyAmounts);
    }
    
    /**
     * @dev Hash for protocol info identifier.
     * @param _user Address of the user.
     * @param _planIndex Index of the plan in the user's plan array.
     * @param _protoIndex Index of the protocol in the plan.
     * @return Hash for identifier for protocolPlan mapping.
    **/
    function _hashKey(address _user, uint256 _planIndex, uint256 _protoIndex)
      internal
      pure
    returns (bytes32)
    {
        return keccak256(abi.encodePacked("ARMORFI.PLAN.", _user, _planIndex, _protoIndex));
    }

}
