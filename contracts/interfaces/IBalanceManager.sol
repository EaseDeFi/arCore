// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IBalanceManager {
  event Deposit(address indexed user, uint256 amount);
  event Withdraw(address indexed user, uint256 amount);
  event Loss(address indexed user, uint256 amount);
  event PriceChange(address indexed user, uint256 price);
  event AffiliatePaid(address indexed affiliate, address indexed referral, uint256 amount, uint256 timestamp);
  event ReferralAdded(address indexed affiliate, address indexed referral, uint256 timestamp);
  function expireBalance(address _user) external;
  function deposit(address _referrer) external payable;
  function withdraw(uint256 _amount) external;
  function initialize(address _armormaster, address _devWallet) external;
  function balanceOf(address _user) external view returns (uint256);
  function perSecondPrice(address _user) external view returns(uint256);
  function changePrice(address user, uint64 _newPricePerSec) external;
}
