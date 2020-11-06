pragma solidity ^0.6.6;

import "../interfaces/IBalanceManager.sol";

contract PlanManagerMock {
  mapping(address => uint256) public prices;
  event UpdateExpireTime(address _user);
  receive() external payable{
  }
  function updateExpireTime(address _user, uint256 _newBalance, uint256 _pricePerSec)  external {
      emit UpdateExpireTime(_user);
      _newBalance; _pricePerSec;
  }
  function changePrice(address _balanceManager, address _user, uint256 _newPrice) external {
      IBalanceManager(_balanceManager).changePrice(_user, _newPrice);
  }
  function changePrice(address _contract, uint256 _newPrice) external {
      prices[_contract] = _newPrice;
  }
}
