// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IRewardDistributionRecipientTokenOnly {
    function notifyRewardAmount(uint256 reward) external;
    function setRewardDistribution(address rewardDistribution) external;
}
