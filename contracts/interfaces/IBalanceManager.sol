pragma solidity ^0.6.6;

interface IBalanceManager {
  event Deposit(address indexed user, uint256 amount);
  event Withdraw(address indexed user, uint256 amount);
  event Loss(address indexed user, uint256 amount);
  event PriceChange(address indexed user, uint256 price);
  function deposit() external payable;
  function withdraw(uint256 _amount) external;
  function updateBalance(address _user) external;
	function initialize(address _planManager) external;
	function balanceOf(address _user) external view returns (uint256);
	function changePrice(address user, uint256 _newPricePerSec) external;
}
