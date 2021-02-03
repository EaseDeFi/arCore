// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.0;

interface IUniswapV2Router02 {
    function swapExactETHForTokens(uint256 minReturn, address[] calldata path, address to, uint256 deadline) external payable returns(uint256[] memory);
}

