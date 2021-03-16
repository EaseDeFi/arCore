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

    /**
     * @dev Update current Armor plan according to new needed funds, price of that, and add new balance.
    **/ 
    function updateArmorPlan() external {
        
        // availableCover will be how much of the desired funds are available to be used as coverage. 
        uint256 availableCover = ArmorCore.availableCover(protocol, funds);

        // Determine Ether cost per second of coverage.
        uint256 pricePerSec = ArmorCore.calculatePricePerSec(protocol, availableCover);

        // Balance of Ether on Armor's BalanceManager contract.
        uint256 balance = ArmorCore.balanceOf();

        // Add funds if balance will not last 30 days.
        uint256 addition = balance > pricePerSec * 30 days ? 0 : pricePerSec - balance;
        
        // Deposit to 1 month of funds in Armor core.
        ArmorCore.deposit(addition);

        // Subscribe to the plan.
        ArmorCore.subscribe(protocol, availableCover);
        
    }

    /**
     * @dev If a hack has occurred, call this to claim the funds that are owed.
     * @param _hackTime is the Unix timestamp that the hack occurred--submitted
     *                  by Armor upon confirmation of hack and made public.
    **/
    function claimArmorPlan(uint256 _hackTime) external {
        ArmorCore.claim(protocol, _hackTime, funds);
    }

    /**
     * @dev Call if for whatever reason the plan must be ended.
    **/
    function endArmorPlan() external {
        ArmorCore.cancelPlan();
    }

    /**
     * @dev Withdraw funds from BalanceManager if they are no longer needed or there is too much.
    **/
    function withdraw() external {

        // Current balance on Armor contract.
        uint256 balance = ArmorCore.balanceOf();

        // Withdraw all funds from Armor Core.
        ArmorCore.withdraw(balance);

    }
}
