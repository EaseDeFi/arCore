// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IBalanceManager {
  event Deposit(address indexed user, uint256 amount);
  event Withdraw(address indexed user, uint256 amount);
  event Loss(address indexed user, uint256 amount);
  event PriceChange(address indexed user, uint256 price);
  event AffiliatePaid(address indexed affiliate, address indexed referral, uint256 amount);
  event ReferralAdded(address indexed addiliate, address indexed referral);
  function deposit(address _referrer) external payable;
  function withdraw(uint256 _amount) external;
  function updateBalance(address _user) external;
	function initialize(address _planManager, address _governanceStaker, address _rewardManager, address _stakeManager, address _devWallet) external;
	function balanceOf(address _user) external view returns (uint256);
  function perSecondPrice(address _user) external view returns(uint256);
	function changePrice(address user, uint256 _newPricePerSec) external;
	
}
