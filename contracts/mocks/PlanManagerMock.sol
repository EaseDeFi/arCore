pragma solidity ^0.6.6;

import "../interfaces/IBalanceManager.sol";

contract PlanManagerMock {
  event UpdateExpireTime(address _user);
  function updateExpireTime(address _user, uint256 _newBalance, uint256 _pricePerSec)  external {
      emit UpdateExpireTime(_user);
  }
  function changePrice(address _balanceManager, address _user, uint256 _newPrice) external {
      IBalanceManager(_balanceManager).changePrice(_user, _newPrice);
  }
}
