pragma solidity ^0.6.6;

interface IRewardManager {
  function initialize(address _rewardToken, address _stakeManager) external;
	function stake(address _user, uint256 _coverPrice) external;
	function withdraw(address _user, uint256 _coverPrice) external;
	function exit(address _user) external;
  function getReward(address _user) external;
}
