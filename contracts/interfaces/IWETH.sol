// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.0;

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}
