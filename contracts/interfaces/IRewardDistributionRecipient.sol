// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IRewardDistributionRecipient {
    function notifyRewardAmount(uint256 reward) external payable;
    function setRewardDistribution(address rewardDistribution) external;
}
