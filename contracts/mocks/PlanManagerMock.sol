// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

import "../interfaces/IBalanceManager.sol";

contract PlanManagerMock {
  mapping(address => uint256) public prices;
  bool coverage;
  event UpdateExpireTime(address _user);
  receive() external payable{
  }
  function updateExpireTime(address _user)  external {
      emit UpdateExpireTime(_user);
  }
  function mockChangePrice(address _balanceManager, address _user, uint64 _newPrice) external {
      IBalanceManager(_balanceManager).changePrice(_user, _newPrice);
  }
  function changePrice(address _contract, uint256 _newPrice) external {
      prices[_contract] = _newPrice;
  }

  function mockCoverage(bool _coverage) external {
    coverage = _coverage;
  }
  function checkCoverage(address _user, address _sc, uint256 _time, uint256 _amount, bytes32[] calldata _path) external view returns(uint256 index, bool check){
    return (0, coverage);
  }
}
