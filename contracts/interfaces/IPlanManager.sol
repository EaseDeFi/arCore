pragma solidity ^0.6.6;

interface IPlanManager {
	function initialize(address _stakeManager, address _balanceManager) external;
	function changePrice(address _scAddress, uint256 _pricePerAmount) external;
	function checkCoverage(address _user, address _protocol, uint256 _hacktime) external returns (uint256);
}