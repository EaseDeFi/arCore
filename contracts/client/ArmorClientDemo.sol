// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.12;
import './ArmorClient.sol';

contract ArmorClientDemo is ArmorClient {

    // Protocol to purchase coverage for.
    address public protocol;
    
    // Amount of funds we must protect on protocol.
    uint256 public funds;

    receive() payable external { }
    
    function updateArmorPlan() external {
        
        // availableCover will be how much of the desired funds are available to be used as coverage. 
        uint256 availableCover = ArmorCore.availableCover(protocol, funds);
        
        // Determine Ether cost per second of coverage.
        uint256 pricePerSec = ArmorCore.calculatePricePerSec(protocol, availableCover);
        
        // Deposit 1 month of funds into Armor core.
        ArmorCore.deposit(pricePerSec * 30 days);
        
        // Subscribe to the plan.
        ArmorCore.subscribe(protocol, availableCover);

    }
    
    function claimArmorPlan(uint256 _hackTime) external {
        ArmorCore.claim(protocol, _hackTime, funds);
    }
    
    function endArmorPlan() external {
        
        // End the plan.
        ArmorCore.cancelPlan();
        
        // Current balance on Armor contract.
        uint256 balance = ArmorCore.balanceOf();
        
        // Withdraw all funds from Armor Core.
        ArmorCore.withdraw(balance);
        
    }

}