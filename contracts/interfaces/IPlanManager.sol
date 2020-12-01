// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IPlanManager {
  // Event to notify frontend of plan update.
  event PlanUpdate(address indexed user, address[] protocols, uint256[] amounts, uint256 endTime);
	function initialize(address _stakeManager, address _balanceManager, address _claimManager) external;
	function changePrice(address _scAddress, uint256 _pricePerAmount) external;
  function updatePlan(address[] calldata _oldProtocols, uint256[] calldata _oldCoverAmounts, address[] calldata _protocols, uint256[] calldata _coverAmounts) external;
	function checkCoverage(address _user, address _protocol, uint256 _hacktime, uint256 _amount, bytes32[] calldata _path) external view returns (uint256, bool);
  function getCurrentPlan(address _user) external view returns(uint128 start, uint128 end, bytes32 root);
  function updateExpireTime(address _user) external;
  function planRedeemed(address _useer, uint256 _planIndex, address _protocol) external;
}
