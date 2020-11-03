pragma solidity ^0.6.6;

interface IRewardManager {
    function initialize(address _rewardToken, address _stakeManager) external;
	function updateStake(address _user) external;
	function stake(address _user, uint256 _coverPrice) external;
	function withdraw(address _user, uint256 _coverPrice) external;
}