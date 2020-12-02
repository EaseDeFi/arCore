pragma solidity ^0.6.6;

interface IRewardManager {
  function initialize(address _rewardToken, address _stakeManager, address _rewardDistribution) external;
	function stake(address _user, uint256 _coverPrice) external;
	function withdraw(address _user, uint256 _coverPrice) external;
	function exit(address payable _user) external;
  function getReward(address payable _user) external;
  function notifyRewardAmount(uint256 _amount) external payable;
}
