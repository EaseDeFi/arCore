// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "../libraries/SafeMath.sol";
import "../interfaces/IArmorMaster.sol";
import "../interfaces/IBalanceManager.sol";
import "../interfaces/IPlanManager.sol";

library ArmorCoreLibrary {
    using SafeMath for uint256;

    IArmorMaster internal constant armorMaster = IArmorMaster(0x1337DEF1900cEaabf5361C3df6aF653D814c6348);

    function getModule(bytes32 _name) internal view returns(address){
        return armorMaster.getModule(_name);
    }

    function subscribeTo(address[] memory _protocols, uint256[] memory _coverAmounts) internal {
        IPlanManager planManager = IPlanManager(getModule("PLAN"));
        planManager.updatePlan(_protocols, _coverAmounts);
    }

    function endCover() internal {
        IPlanManager planManager = IPlanManager(getModule("PLAN"));
        address[] memory emptyProtocols = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);
        planManager.updatePlan(emptyProtocols, emptyAmounts);
    }


    function calculatePricePerSec(address[] memory _protocols, uint256[] memory _coverAmounts) internal view returns(uint256 pricePerSec) {
        require(_protocols.length == _coverAmounts.length, "Armor: array length diff");
        for(uint256 i = 0; i<_protocols.length; i++){
            pricePerSec = pricePerSec.add(pricePerETH(_protocols[i]).mul(_coverAmounts[i]));
        }
        return pricePerSec.div(1e18);
    }

    function calculatePrice(address _protocol, uint256 _coverAmount) internal view returns(uint256 pricePerSec) {
        return pricePerETH(_protocol).mul(_coverAmount).div(1e18);
    }

    function pricePerETH(address _protocol) internal view returns(uint256 pricePerSecPerETH) {
        IPlanManager planManager = IPlanManager(getModule("PLAN"));
        pricePerSecPerETH = planManager.nftCoverPrice(_protocol).mul(planManager.markup()).div(100);
    }

    function deposit(uint256 amount) internal {
        IBalanceManager balanceManager = IBalanceManager(getModule("BALANCE"));
        balanceManager.deposit{value:amount}(address(0));
    }

    function withdraw(uint256 amount) internal {
        IBalanceManager balanceManager = IBalanceManager(getModule("BALANCE"));
        balanceManager.withdraw(amount);
    }
}
