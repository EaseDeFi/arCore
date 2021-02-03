// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.0;

interface IBFactory {
    function isBPool(address _pool) external view returns(bool);
}

interface IBPool {
    function swapExactAmountIn(address tokenin, uint256 inamount, address out, uint256 minreturn, uint256 maxprice) external returns(uint tokenAmountOut, uint spotPriceAfter);
}
