pragma solidity ^0.6.6;

interface IRewardManager {
    function initialize(address _stakeManager) external;
	function updateStake(address _user) external;
	function addStakes(address _user, uint256 _coverPrice) external;
	function subStakes(address _user, uint256 _coverPrice) external;
}