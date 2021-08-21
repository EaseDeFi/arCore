// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IBalanceWrapper {
  function balanceOf(address _user) external view returns (uint256);
}
