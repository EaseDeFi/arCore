// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "../libraries/SafeMath.sol";
import "../interfaces/IArmorMaster.sol";
import "../interfaces/IBalanceManager.sol";
import "../interfaces/IPlanManager.sol";

library ArmorCoreLibrary {
    using SafeMath for uint256;

    IArmorMaster internal constant armorMaster = IArmorMaster(0x1337DEF1900cEaabf5361C3df6aF653D814c6348);

    /**
     * @dev Get Armor module such as BalanceManager, PlanManager, etc.
     * @param _name Name of the module (such as "BALANCE").
    **/
    function getModule(bytes32 _name) internal view returns(address){
        return armorMaster.getModule(_name);
    }

    /**
     * @dev Calculate the price per second for a specific amount of Ether.
     * @param _protocol Address of protocol to protect.
     * @param _coverAmount Amount of Ether to cover (in Wei). We div by 1e18 at the end because both _coverAmount and pricePerETH return are 1e18.
     * @return pricePerSec Ether (in Wei) price per second of this coverage.
    **/
    function calculatePricePerSec(address _protocol, uint256 _coverAmount) internal view returns(uint256 pricePerSec) {
        return pricePerETH(_protocol).mul(_coverAmount).div(1e18);
    }

    /**
     * @dev Calculate price per second for an array of protocols and amounts.
     * @param _protocols Protocols to protect.
     * @param _coverAmounts Amounts (in Wei) of Ether to protect.
     * @return pricePerSec Ether (in Wei) price per second of this coverage,
    **/
    function calculatePricePerSecArray(address[] memory _protocols, uint256[] memory _coverAmounts) internal view returns(uint256 pricePerSec) {
        require(_protocols.length == _coverAmounts.length, "Armor: array length diff");
        for(uint256 i = 0; i<_protocols.length; i++){
            pricePerSec = pricePerSec.add(pricePerETH(_protocols[i]).mul(_coverAmounts[i]));
        }
        return pricePerSec.div(1e18);
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
    function subscribeTo(address[] memory _protocols, uint256[] memory _coverAmounts) internal {
        IPlanManager planManager = IPlanManager(getModule("PLAN"));
        planManager.updatePlan(_protocols, _coverAmounts);
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
    **/
    function claim() internal {

    }
    // Claim

    /**
     * @dev End Armor coverage. 
    **/
    function endCover() internal {
        IPlanManager planManager = IPlanManager(getModule("PLAN"));
        address[] memory emptyProtocols = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);
        planManager.updatePlan(emptyProtocols, emptyAmounts);
    }

}
