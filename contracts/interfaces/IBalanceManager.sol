pragma solidity ^0.6.6;

interface IBalanceManager {
	function initialize(address _planManager) external;
	function balanceOf(address _user) external returns (uint256);
	function changePrice(address user, uint256 _newPricePerSec) external;
}