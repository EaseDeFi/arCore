// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.12;
import './ArmorClient.sol';

contract ArmorClientDemo is ArmorClient {

    // Protocol to purchase coverage for.
    address public protocol;

    // Amount of funds we must protect on protocol.
    uint256 public funds;

    receive() payable external { }

    //demo function to set using protocol
    function setProtocol(address _protocol) external {
        protocol = _protocol;
    }

    //demo function to set fund amount
    function setFunds(uint256 _funds) external {
        funds = _funds;
    }

    function updateArmorPlan() external {
        // availableCover will be how much of the desired funds are available to be used as coverage. 
        uint256 availableCover = ArmorCore.availableCover(protocol, funds);

        // Determine Ether cost per second of coverage.
        uint256 pricePerSec = ArmorCore.calculatePricePerSec(protocol, availableCover);

        uint256 balance = ArmorCore.balanceOf();
        uint256 addition = balance > pricePerSec * 30 days ? 0 : pricePerSec - balance;
        
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
    }

    function withdraw() external {
        // Current balance on Armor contract.
        uint256 balance = ArmorCore.balanceOf();

        // Withdraw all funds from Armor Core.
        ArmorCore.withdraw(balance);
    }
}
