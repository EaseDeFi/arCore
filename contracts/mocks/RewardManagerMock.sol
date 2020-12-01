// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

contract RewardManagerMock {
    mapping(address => uint256) public stakes;
    function stake(address _user, uint256 _price) external {
        stakes[_user] += _price;
    }

    function withdraw(address _user, uint256 _amount) external {
        stakes[_user] -= _amount;
    }
}
