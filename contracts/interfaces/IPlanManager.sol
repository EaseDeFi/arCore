// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IPlanManager {
  // Mapping = protocol => cover amount
  struct Plan {
      uint64 startTime;
      uint64 endTime;
      uint128 length;
  }
  
  struct ProtocolPlan {
      uint64 protocolId;
      uint192 amount;
  }
    
  // Event to notify frontend of plan update.
  event PlanUpdate(address indexed user, address[] protocols, uint256[] amounts, uint256 endTime);
  function userCoverageLimit(address _user, address _protocol) external view returns(uint256);
  function markup() external view returns(uint256);
  function nftCoverPrice(address _protocol) external view returns(uint256);
  function initialize(address _armorManager) external;
  function changePrice(address _scAddress, uint256 _pricePerAmount) external;
  function updatePlan(address[] calldata _protocols, uint256[] calldata _coverAmounts) external;
  function checkCoverage(address _user, address _protocol, uint256 _hacktime, uint256 _amount) external view returns (uint256, bool);
  function coverageLeft(address _protocol) external view returns(uint256);
  function getCurrentPlan(address _user) external view returns(uint256 idx, uint128 start, uint128 end);
  function updateExpireTime(address _user, uint256 _expiry) external;
  function planRedeemed(address _user, uint256 _planIndex, address _protocol) external;
  function totalUsedCover(address _scAddress) external view returns (uint256);
}
