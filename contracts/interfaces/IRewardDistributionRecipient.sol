pragma solidity ^0.6.6;

import '../general/Ownable.sol';

abstract contract IRewardDistributionRecipient is Ownable {
    address rewardDistribution;

    modifier onlyRewardDistribution() {
        require(msg.sender == rewardDistribution, "Caller is not reward distribution");
        _;
    }

    function notifyRewardAmount(uint256 reward) external virtual;

    function setRewardDistribution(address _rewardDistribution)
        external
        onlyOwner
    {
        rewardDistribution = _rewardDistribution;
    }
}