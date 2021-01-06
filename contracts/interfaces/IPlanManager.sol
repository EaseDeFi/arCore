// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IPlanManager {
  // Event to notify frontend of plan update.
  event PlanUpdate(address indexed user, address[] protocols, uint256[] amounts, uint256 endTime);
  function initialize(address _armorManager) external;
  function changePrice(address _scAddress, uint256 _pricePerAmount) external;
  function updatePlan(address[] calldata _protocols, uint256[] calldata _coverAmounts) external;
  function checkCoverage(address _user, address _protocol, uint256 _hacktime, uint256 _amount) external view returns (uint256, bool);
  function coverageLeft(address _protocol) external view returns(uint256);
  function getCurrentPlan(address _user) external view returns(uint128 start, uint128 end);
  function updateExpireTime(address _user) external;
  function planRedeemed(address _useer, uint256 _planIndex, address _protocol) external;
}
