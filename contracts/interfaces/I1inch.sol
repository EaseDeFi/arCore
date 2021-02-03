// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.12;

import './IERC20.sol';

interface I1inch {
    function swap(IERC20 fromToken, IERC20 destToken, uint256 amount, uint256 minReturn, uint256[] memory distribution, uint256 flags) external returns(uint256 returnAmount);
}