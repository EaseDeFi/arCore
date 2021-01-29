// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

import './IRewardDistributionRecipient.sol';

interface IUtilizationFarm is IRewardDistributionRecipient {
  function initialize(address _rewardToken, address _stakeManager) external;
  function stake(address _user, uint256 _coverPrice) external;
  function withdraw(address _user, uint256 _coverPrice) external;
  function getReward(address payable _user) external;
}
